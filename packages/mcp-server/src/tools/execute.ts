/**
 * quokka_execute — Execute a browser task from an intent string.
 *
 * Builds a RecipeV2 on the fly, runs it via PlaywrightRunner logic,
 * and returns the structured result.
 */

import { nanoid } from 'nanoid'
import type { RecipeV2, ActionStep } from '@quokka/shared'
import {
  ExecutionPlanner,
  type ModelProvider,
  type LLMProvider,
  type ChatMessage,
} from '@quokka/core'
import { PlaywrightRunner, type RunResult } from '@quokka/runner-playwright'
import type { Session, SessionManager } from '../session.js'

export interface ExecuteInput {
  intent: string
  url?: string
  variables?: Record<string, string>
  session_id?: string
}

export interface ExecuteOutput {
  status: 'completed' | 'failed'
  data: Record<string, unknown>
  artifacts: string[]
  session_id: string
  error?: string
}

/**
 * Decompose a complex intent into individual action steps using the LLM.
 */
async function decomposeIntent(
  intent: string,
  url: string | undefined,
  llmProvider: LLMProvider,
): Promise<ActionStep[]> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a browser automation planner. Given a user intent, decompose it into individual action steps.
Each step should be a single browser action (click, type, navigate, etc.).
Return a JSON array of objects with: { "intent": string, "context_hint": string, "value"?: string, "likelyNavigates": boolean }
Only return the JSON array, no other text.`,
    },
    {
      role: 'user',
      content: url
        ? `Intent: "${intent}"\nStarting URL: ${url}`
        : `Intent: "${intent}"`,
    },
  ]

  try {
    const steps = await llmProvider.completeJSON<
      Array<{
        intent: string
        context_hint: string
        value?: string
        likelyNavigates: boolean
      }>
    >(messages, {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          intent: { type: 'string' },
          context_hint: { type: 'string' },
          value: { type: 'string' },
          likelyNavigates: { type: 'boolean' },
        },
        required: ['intent', 'context_hint', 'likelyNavigates'],
      },
    })

    return steps.map((s, i) => ({
      id: `step-${i + 1}`,
      type: 'action' as const,
      intent: s.intent,
      context_hint: s.context_hint,
      value: s.value,
      likelyNavigates: s.likelyNavigates,
    }))
  } catch {
    // Fallback: treat the entire intent as a single step
    return [
      {
        id: 'step-1',
        type: 'action' as const,
        intent,
        context_hint: url ? `Starting at ${url}` : '',
        likelyNavigates: false,
      },
    ]
  }
}

/**
 * Build an ad-hoc RecipeV2 from intent and steps.
 */
function buildRecipe(
  intent: string,
  steps: ActionStep[],
  url?: string,
  variables?: Record<string, string>,
): RecipeV2 {
  const allSteps: RecipeV2['steps'] = [...steps]

  return {
    version: '2.0',
    id: nanoid(12),
    name: `mcp-execute-${Date.now()}`,
    description: intent,
    intent,
    steps: allSteps,
    variables: variables ?? {},
    hosts: url ? [new URL(url).hostname] : [],
    meta: { createdFrom: 'prompt' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function handleExecute(
  input: ExecuteInput,
  sessionManager: SessionManager,
  modelProvider: ModelProvider,
  llmProvider: LLMProvider,
): Promise<ExecuteOutput> {
  const session = await sessionManager.getOrCreateSession(input.session_id)

  session.history.push({
    tool: 'quokka_execute',
    intent: input.intent,
    timestamp: Date.now(),
  })

  try {
    // Navigate to URL if provided
    if (input.url) {
      await session.page.goto(input.url, { waitUntil: 'domcontentloaded' })
    }

    // Decompose intent into steps
    const steps = await decomposeIntent(input.intent, input.url, llmProvider)

    // Build ad-hoc recipe
    const recipe = buildRecipe(input.intent, steps, input.url, input.variables)

    // Run via PlaywrightRunner
    const runner = new PlaywrightRunner({ headless: true })
    let result: RunResult

    try {
      result = await runner.run(recipe, input.variables ?? {}, modelProvider)
    } finally {
      await runner.close()
    }

    return {
      status: result.status,
      data: {
        stepsExecuted: result.stepsExecuted,
        totalSteps: result.totalSteps,
        duration: result.duration,
        currentUrl: session.page.url(),
        pageTitle: await session.page.title(),
      },
      artifacts: result.screenshots ?? [],
      session_id: session.id,
      error: result.error,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 'failed',
      data: {},
      artifacts: [],
      session_id: session.id,
      error: message,
    }
  }
}
