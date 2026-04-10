/**
 * quokka_plan — Plan a multi-step browser task without executing.
 *
 * Uses the LLM to decompose a high-level goal into IntentSteps.
 */

import type { IntentStep } from '@quokka/core'
import type { LLMProvider, ChatMessage } from '@quokka/core'

export interface PlanInput {
  goal: string
  start_url: string
}

export interface PlanOutput {
  steps: IntentStep[]
  estimated_pages: number
}

export async function handlePlan(
  input: PlanInput,
  llmProvider: LLMProvider,
): Promise<PlanOutput> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a browser automation planner. Given a high-level goal and a starting URL, decompose the goal into a sequence of intent-based steps that a browser automation agent would execute.

Each step should have:
- "id": a unique step id like "step-1", "step-2", etc.
- "type": always "action"
- "intent": what the step should accomplish (e.g. "Click the login button")
- "context_hint": context about what page element or area to interact with
- "value": optional value to type or select
- "verification": optional check to confirm the step succeeded
- "likelyNavigates": whether this step is expected to cause a page navigation

Also estimate how many distinct pages this plan will visit.

Return JSON: { "steps": [...], "estimated_pages": number }`,
    },
    {
      role: 'user',
      content: `Goal: "${input.goal}"
Starting URL: ${input.start_url}`,
    },
  ]

  const result = await llmProvider.completeJSON<{
    steps: Array<{
      id: string
      type: 'action'
      intent: string
      context_hint: string
      value?: string
      verification?: string
      likelyNavigates: boolean
    }>
    estimated_pages: number
  }>(messages, {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['action'] },
            intent: { type: 'string' },
            context_hint: { type: 'string' },
            value: { type: 'string' },
            verification: { type: 'string' },
            likelyNavigates: { type: 'boolean' },
          },
          required: ['id', 'type', 'intent', 'context_hint', 'likelyNavigates'],
        },
      },
      estimated_pages: { type: 'number' },
    },
    required: ['steps', 'estimated_pages'],
  })

  return {
    steps: result.steps.map((s) => ({
      id: s.id,
      type: 'action' as const,
      intent: s.intent,
      context_hint: s.context_hint,
      value: s.value,
      verification: s.verification,
      likelyNavigates: s.likelyNavigates,
    })),
    estimated_pages: result.estimated_pages,
  }
}
