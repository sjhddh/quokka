import type { ModelProvider } from '../providers/provider.js'
import type { PageSnapshot } from '../sanitizer/dom-sanitizer.js'
import {
  EXECUTION_PLANNING_SYSTEM_PROMPT,
  buildPlanningPrompt,
  buildFailureRecoveryPrompt,
} from './prompts.js'
import type { IntentStep, PlannedAction } from './prompts.js'

// ─── Re-export ────────────────────────────────────────────────────────────────

export type { PlannedAction } from './prompts.js'

export interface ExecutionPlan {
  pageUrl: string
  structuralHash: string
  actions: PlannedAction[]
  createdAt: number
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_ACTIONS = new Set(['click', 'type', 'select', 'scroll', 'wait', 'navigate'])

/**
 * Validate and coerce one raw object from LLM output into a PlannedAction.
 * Returns null if the shape is unrecoverable.
 */
function parsePlannedAction(raw: unknown, index: number): PlannedAction | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const stepId = typeof obj.stepId === 'string' && obj.stepId.length > 0 ? obj.stepId : `step_${index}`
  const action = typeof obj.action === 'string' && VALID_ACTIONS.has(obj.action)
    ? (obj.action as PlannedAction['action'])
    : null

  if (!action) return null

  const selector = typeof obj.selector === 'string' && obj.selector.trim().length > 0
    ? obj.selector.trim()
    : null

  if (!selector) return null

  const confidence = typeof obj.confidence === 'number'
    ? Math.max(0, Math.min(1, obj.confidence))
    : 0.5

  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : ''
  const value = typeof obj.value === 'string' ? obj.value : undefined

  const fallbackSelectors: string[] | undefined = Array.isArray(obj.fallbackSelectors)
    ? (obj.fallbackSelectors as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : undefined

  return {
    stepId,
    action,
    selector,
    value,
    confidence,
    reasoning,
    ...(fallbackSelectors && fallbackSelectors.length > 0 ? { fallbackSelectors } : {}),
  }
}

/**
 * Strip markdown code fences that some LLMs add despite instructions.
 */
function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}

/**
 * Parse LLM response as a JSON array of PlannedActions.
 * Returns a tuple [actions, parseError].
 */
function parseActionsResponse(raw: string, expectedStepIds: string[]): [PlannedAction[], string | null] {
  const cleaned = stripFences(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    return [[], `JSON parse error: ${err instanceof Error ? err.message : String(err)}`]
  }

  if (!Array.isArray(parsed)) {
    return [[], `Expected JSON array, got ${typeof parsed}`]
  }

  const actions: PlannedAction[] = []
  const errors: string[] = []

  for (let i = 0; i < parsed.length; i++) {
    const action = parsePlannedAction(parsed[i], i)
    if (!action) {
      errors.push(`Index ${i}: invalid action shape`)
      continue
    }
    actions.push(action)
  }

  // Warn if step coverage is incomplete but still return what we have
  const returnedIds = new Set(actions.map(a => a.stepId))
  const missing = expectedStepIds.filter(id => !returnedIds.has(id))
  if (missing.length > 0) {
    errors.push(`Missing plan for steps: ${missing.join(', ')}`)
  }

  return [actions, errors.length > 0 ? errors.join('; ') : null]
}

// ─── ExecutionPlanner ─────────────────────────────────────────────────────────

export class ExecutionPlanner {
  constructor(private provider: ModelProvider) {}

  /**
   * Plan execution for a set of intent steps on a specific page.
   * Called once per page boundary — results should be cached by the caller.
   */
  async planPage(steps: IntentStep[], snapshot: PageSnapshot): Promise<ExecutionPlan> {
    if (steps.length === 0) {
      return {
        pageUrl: snapshot.url,
        structuralHash: snapshot.structuralHash,
        actions: [],
        createdAt: Date.now(),
      }
    }

    const prompt = buildPlanningPrompt(steps, snapshot)

    let raw: string
    try {
      raw = await this.provider.complete(prompt, {
        system: EXECUTION_PLANNING_SYSTEM_PROMPT,
        temperature: 0,  // deterministic planning
      })
    } catch (err) {
      throw new Error(
        `ExecutionPlanner: LLM call failed — ${err instanceof Error ? err.message : String(err)}`
      )
    }

    const expectedIds = steps.map(s => s.id)
    const [actions, parseError] = parseActionsResponse(raw, expectedIds)

    if (actions.length === 0) {
      throw new Error(
        `ExecutionPlanner: no valid actions in LLM response. Parse error: ${parseError ?? 'unknown'}. Raw: ${raw.slice(0, 200)}`
      )
    }

    // Log parse warnings without throwing — partial plans are better than no plan
    if (parseError) {
      console.warn(`[ExecutionPlanner] planPage parse warnings: ${parseError}`)
    }

    return {
      pageUrl: snapshot.url,
      structuralHash: snapshot.structuralHash,
      actions,
      createdAt: Date.now(),
    }
  }

  /**
   * Handle a failed step — re-plan with the error context and a fresh DOM snapshot.
   * Returns a single corrected PlannedAction. Throws if recovery also fails.
   */
  async handleFailure(
    failedAction: PlannedAction,
    error: string,
    snapshot: PageSnapshot,
    originalStep: IntentStep,
  ): Promise<PlannedAction> {
    const prompt = buildFailureRecoveryPrompt(failedAction, error, snapshot, originalStep)

    let raw: string
    try {
      raw = await this.provider.complete(prompt, {
        system: EXECUTION_PLANNING_SYSTEM_PROMPT,
        temperature: 0.2,  // slight creativity for recovery vs deterministic planning
      })
    } catch (err) {
      throw new Error(
        `ExecutionPlanner: recovery LLM call failed — ${err instanceof Error ? err.message : String(err)}`
      )
    }

    const [actions, parseError] = parseActionsResponse(raw, [originalStep.id])

    if (actions.length === 0) {
      throw new Error(
        `ExecutionPlanner: recovery produced no valid action. Parse error: ${parseError ?? 'unknown'}. Raw: ${raw.slice(0, 200)}`
      )
    }

    const recovered = actions[0]

    // Guard against re-using selectors that already failed
    const alreadyTried = new Set([
      failedAction.selector,
      ...(failedAction.fallbackSelectors ?? []),
    ])

    if (alreadyTried.has(recovered.selector)) {
      throw new Error(
        `ExecutionPlanner: recovery proposed the same selector that already failed: "${recovered.selector}"`
      )
    }

    return recovered
  }
}
