import type { Recipe, Step, Run, RunEvent, Condition } from '@quokka/shared'
import type { StepCommand, StepResult } from './content-executor'
import { saveCheckpoint, clearCheckpoint, type ExecutionCheckpoint } from './checkpoint'

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export type ReplayEventType = RunEvent['type']

export interface ReplayCallbacks {
  /** Called for each replay event (step_started, step_succeeded, etc.) */
  onEvent: (event: RunEvent) => void
  /** Called when a checkpoint step is reached. Must resolve to true (approve) or false (reject). */
  onCheckpoint: (message: string) => Promise<boolean>
  /** Execute a step command on the content script. Returns StepResult. */
  executeStep: (tabId: number, cmd: StepCommand) => Promise<StepResult>
}

/**
 * Dispatch a recipe for replay using the in-extension runtime.
 * Iterates through steps, sends each to the content script, and reports events.
 *
 * Pass `resumeFrom` to resume execution from a saved checkpoint after a SW restart.
 */
export async function dispatchReplay(
  recipe: Recipe,
  slotValues: Record<string, string>,
  tabId: number,
  callbacks: ReplayCallbacks,
  resumeFrom?: ExecutionCheckpoint,
): Promise<Run> {
  const run: Run = {
    id: resumeFrom?.runId ?? makeId('run'),
    recipeId: recipe.id,
    status: 'running',
    slotValues,
    currentStepIndex: resumeFrom?.currentStepIndex ?? 0,
    startedAt: resumeFrom?.startedAt ?? new Date().toISOString(),
  }

  // Save an initial checkpoint before the first step (or mark resuming)
  await saveCheckpoint({
    runId: run.id,
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeVersion: recipe.version ?? '1.0',
    slotValues,
    tabId,
    currentStepIndex: run.currentStepIndex,
    totalSteps: recipe.steps.length,
    status: 'running',
    startedAt: run.startedAt!,
    lastStepAt: new Date().toISOString(),
    events: resumeFrom?.events ?? [],
  })

  if (!resumeFrom) {
    emitEvent(callbacks, 'run_started', run)
  }

  try {
    const startIndex = resumeFrom?.currentStepIndex ?? 0
    const result = await executeSteps(
      recipe.steps,
      slotValues,
      tabId,
      callbacks,
      run,
      recipe,
      startIndex,
    )
    if (result === 'failed') {
      await clearCheckpoint()
      return run
    }

    run.status = 'completed'
    run.finishedAt = new Date().toISOString()
    await clearCheckpoint()
    emitEvent(callbacks, 'run_completed', run)
  } catch (err) {
    run.status = 'failed'
    run.error = err instanceof Error ? err.message : String(err)
    run.finishedAt = new Date().toISOString()
    await clearCheckpoint()
    emitEvent(callbacks, 'run_failed', run)
  }

  return run
}

/**
 * Resume a replay from a saved checkpoint. Verifies the tab is still alive
 * and the recipe still exists before re-entering executeSteps.
 */
export async function resumeReplay(
  checkpoint: ExecutionCheckpoint,
  recipe: Recipe,
  callbacks: ReplayCallbacks,
): Promise<Run> {
  // Verify the target tab is still alive
  try {
    await chrome.tabs.get(checkpoint.tabId)
  } catch {
    // Tab was closed while SW was sleeping — can't resume
    await clearCheckpoint()
    const run: Run = {
      id: checkpoint.runId,
      recipeId: checkpoint.recipeId,
      status: 'failed',
      slotValues: checkpoint.slotValues,
      currentStepIndex: checkpoint.currentStepIndex,
      startedAt: checkpoint.startedAt,
      finishedAt: new Date().toISOString(),
      error: 'Tab was closed while the extension was inactive',
    }
    return run
  }

  return dispatchReplay(recipe, checkpoint.slotValues, checkpoint.tabId, callbacks, checkpoint)
}

/**
 * Execute a list of steps. Returns 'ok' if all steps succeed, 'failed' if any fails.
 * Supports recursive execution for conditional branches.
 *
 * `startIndex` allows resuming from a checkpoint; only used at the top-level call.
 * `recipe` is passed through solely so we can checkpoint `totalSteps`.
 */
async function executeSteps(
  steps: Step[],
  slotValues: Record<string, string>,
  tabId: number,
  callbacks: ReplayCallbacks,
  run: Run,
  recipe?: Recipe,
  startIndex = 0,
): Promise<'ok' | 'failed'> {
  for (let i = startIndex; i < steps.length; i++) {
    run.currentStepIndex = i
    const step = steps[i]

    // Handle checkpoint steps
    if (step.type === 'checkpoint') {
      emitEvent(callbacks, 'checkpoint_required', run, i, { message: step.message })
      const approved = await callbacks.onCheckpoint(step.message)
      if (approved) {
        emitEvent(callbacks, 'checkpoint_approved', run, i)
      } else {
        run.status = 'failed'
        run.error = 'Checkpoint rejected'
        run.finishedAt = new Date().toISOString()
        emitEvent(callbacks, 'checkpoint_rejected', run, i)
        emitEvent(callbacks, 'run_failed', run)
        return 'failed'
      }
      continue
    }

    // Handle conditional steps
    if (step.type === 'conditional') {
      const conditionResult = await evaluateCondition(step.condition, tabId, callbacks)
      emitEvent(callbacks, 'condition_evaluated', run, i, {
        condition: step.condition,
        result: conditionResult,
      })

      const branch = conditionResult ? step.thenSteps : (step.elseSteps ?? [])
      if (branch.length > 0) {
        const branchResult = await executeSteps(branch, slotValues, tabId, callbacks, run)
        if (branchResult === 'failed') return 'failed'
      }
      continue
    }

    emitEvent(callbacks, 'step_started', run, i)

    const cmd = stepToCommand(step, slotValues)
    const result = await callbacks.executeStep(tabId, cmd)

    if (result.ok) {
      emitEvent(callbacks, 'step_succeeded', run, i, result.data ? { data: result.data } : undefined)

      // Checkpoint after each successful step so we can resume if SW is killed
      if (recipe) {
        await saveCheckpoint({
          runId: run.id,
          recipeId: run.recipeId,
          recipeName: recipe.name,
          recipeVersion: recipe.version ?? '1.0',
          slotValues,
          tabId,
          currentStepIndex: i + 1,
          totalSteps: recipe.steps.length,
          status: 'running',
          startedAt: run.startedAt!,
          lastStepAt: new Date().toISOString(),
          events: [],
        })
      }

      // After navigate, wait for the page to settle
      if (step.type === 'navigate') {
        await sleep(1500)
      }
    } else {
      run.status = 'failed'
      run.error = result.error
      run.finishedAt = new Date().toISOString()
      emitEvent(callbacks, 'step_failed', run, i, { error: result.error })
      emitEvent(callbacks, 'run_failed', run)
      return 'failed'
    }
  }
  return 'ok'
}

/**
 * Evaluate a condition for a conditional step.
 */
async function evaluateCondition(
  condition: Condition,
  tabId: number,
  callbacks: ReplayCallbacks,
): Promise<boolean> {
  switch (condition.type) {
    case 'element_exists': {
      const result = await callbacks.executeStep(tabId, {
        type: 'check_selector',
        locator: condition.target,
      })
      return result.ok && result.data === 'true'
    }
    case 'element_not_exists': {
      const result = await callbacks.executeStep(tabId, {
        type: 'check_selector',
        locator: condition.target,
      })
      return result.ok && result.data === 'false'
    }
    case 'url_matches': {
      try {
        const tab = await chrome.tabs.get(tabId)
        const regex = new RegExp(condition.pattern)
        return regex.test(tab.url ?? '')
      } catch {
        return false
      }
    }
  }
}

function stepToCommand(step: Step, slotValues: Record<string, string>): StepCommand {
  switch (step.type) {
    case 'click':
      return { type: 'click', locator: step.target, slotValues }
    case 'type':
      return { type: 'type', locator: step.target, value: step.value, slotValues }
    case 'navigate':
      return { type: 'navigate', url: step.url, slotValues }
    case 'extract':
      return { type: 'extract', locator: step.target, slotValues }
    case 'wait':
      return { type: 'wait', locator: step.target, timeout: step.timeout, slotValues }
    case 'checkpoint':
      // Shouldn't reach here — checkpoints are handled before stepToCommand
      return { type: 'wait', timeout: 0 }
    case 'conditional':
      // Shouldn't reach here — conditionals are handled before stepToCommand
      return { type: 'wait', timeout: 0 }
    default:
      // scroll, select, hover — pass through as click-like commands
      return { type: 'click', locator: (step as { target: Step extends { target: infer T } ? T : never }).target, slotValues }
  }
}

function emitEvent(
  callbacks: ReplayCallbacks,
  type: RunEvent['type'],
  run: Run,
  stepIndex?: number,
  payload?: unknown,
): void {
  callbacks.onEvent({
    id: makeId('evt'),
    runId: run.id,
    type,
    stepIndex,
    payload,
    timestamp: new Date().toISOString(),
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
