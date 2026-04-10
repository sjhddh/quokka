import { nanoid } from 'nanoid'
import type { LLMProvider } from '../providers/types.js'
import {
  INTENT_EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
  buildBatchExtractionPrompt,
} from './prompts.js'

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface RawActionCapture {
  type: 'click' | 'type' | 'navigate' | 'select' | 'scroll'
  element?: {
    tag: string
    text?: string
    ariaLabel?: string
    role?: string
    placeholder?: string
    name?: string
    type?: string
    selector: string
  }
  /** For type/select actions. Already redacted by the credential filter upstream. */
  value?: string
  /** For navigate actions. */
  url?: string
  pageUrl: string
  pageTitle: string
  surroundingContext?: string
  timestamp: number
}

export interface IntentStep {
  id: string
  type: 'action'
  intent: string
  context_hint: string
  value?: string
  verification?: string
  likelyNavigates: boolean
}

export interface PageBoundaryStep {
  id: string
  type: 'page_boundary'
  expectedUrl?: string
  waitCondition: 'networkIdle' | 'domContentLoaded' | 'load'
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM response shapes (before we add generated ids)
// ─────────────────────────────────────────────────────────────────────────────

interface RawIntentStep {
  type: 'action'
  intent: string
  context_hint: string
  value?: string
  verification?: string
  likelyNavigates: boolean
}

interface RawPageBoundaryStep {
  type: 'page_boundary'
  expectedUrl?: string
  waitCondition: 'networkIdle' | 'domContentLoaded' | 'load'
}

type RawStep = RawIntentStep | RawPageBoundaryStep

// ─────────────────────────────────────────────────────────────────────────────
// Response parser / validator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip markdown code fences that some models emit despite instructions.
 */
function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

/**
 * Validate and normalise a single raw step object from the LLM.
 * Throws a descriptive error if the shape is unrecognisable.
 */
function validateRawStep(raw: unknown, index?: number): RawStep {
  const label = index !== undefined ? ` (item ${index})` : ''

  if (!raw || typeof raw !== 'object') {
    throw new Error(`Intent response${label}: expected object, got ${typeof raw}`)
  }

  const obj = raw as Record<string, unknown>

  if (obj.type === 'page_boundary') {
    const waitCondition = obj.waitCondition as string
    if (!['networkIdle', 'domContentLoaded', 'load'].includes(waitCondition)) {
      // Fall back to a safe default rather than hard-failing
      obj.waitCondition = 'load'
    }
    return {
      type: 'page_boundary',
      expectedUrl: typeof obj.expectedUrl === 'string' ? obj.expectedUrl : undefined,
      waitCondition: obj.waitCondition as 'networkIdle' | 'domContentLoaded' | 'load',
    }
  }

  if (obj.type === 'action') {
    if (typeof obj.intent !== 'string' || obj.intent.trim() === '') {
      throw new Error(`Intent response${label}: "intent" must be a non-empty string`)
    }
    if (typeof obj.context_hint !== 'string') {
      // Non-fatal — synthesise a fallback
      obj.context_hint = ''
    }
    if (typeof obj.likelyNavigates !== 'boolean') {
      // Coerce loosely: treat truthy string "true" as well as actual booleans
      obj.likelyNavigates = obj.likelyNavigates === true || obj.likelyNavigates === 'true'
    }
    return {
      type: 'action',
      intent: (obj.intent as string).trim(),
      context_hint: (obj.context_hint as string).trim(),
      value: typeof obj.value === 'string' ? obj.value : undefined,
      verification: typeof obj.verification === 'string' ? obj.verification.trim() : undefined,
      likelyNavigates: obj.likelyNavigates as boolean,
    }
  }

  throw new Error(
    `Intent response${label}: unknown type "${String(obj.type)}" — expected "action" or "page_boundary"`
  )
}

/**
 * Parse a single-step LLM response.
 */
export function parseIntentResponse(text: string): RawStep {
  const cleaned = stripFences(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Intent response: invalid JSON — ${cleaned.slice(0, 200)}`)
  }
  return validateRawStep(parsed)
}

/**
 * Parse a batch LLM response (JSON array of steps).
 */
export function parseIntentBatchResponse(text: string, expectedCount: number): RawStep[] {
  const cleaned = stripFences(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Intent batch response: invalid JSON — ${cleaned.slice(0, 200)}`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Intent batch response: expected array, got ${typeof parsed}`)
  }

  if (parsed.length !== expectedCount) {
    throw new Error(
      `Intent batch response: expected ${expectedCount} items, got ${parsed.length}`
    )
  }

  return parsed.map((item, i) => validateRawStep(item, i))
}

// ─────────────────────────────────────────────────────────────────────────────
// Attach generated IDs
// ─────────────────────────────────────────────────────────────────────────────

function materialize(raw: RawStep): IntentStep | PageBoundaryStep {
  const id = nanoid()
  if (raw.type === 'page_boundary') {
    return { id, ...raw }
  }
  return { id, ...raw }
}

// ─────────────────────────────────────────────────────────────────────────────
// IntentExtractor
// ─────────────────────────────────────────────────────────────────────────────

export class IntentExtractor {
  constructor(private provider: LLMProvider) {}

  /**
   * Extract the intent for a single user action.
   *
   * Falls back to a best-effort IntentStep on LLM or parse errors so that
   * recording is never blocked by intent extraction failures.
   */
  async extractIntent(capture: RawActionCapture): Promise<IntentStep | PageBoundaryStep> {
    const messages = [
      { role: 'system' as const, content: INTENT_EXTRACTION_SYSTEM_PROMPT },
      { role: 'user' as const, content: buildExtractionPrompt(capture) },
    ]

    let raw: RawStep
    try {
      const response = await this.provider.complete(messages, {
        temperature: 0.2,
        maxTokens: 512,
      })
      raw = parseIntentResponse(response)
    } catch (err) {
      // Degrade gracefully — produce a fallback step rather than breaking recording
      raw = buildFallbackStep(capture, err)
    }

    return materialize(raw)
  }

  /**
   * Extract intents for a batch of actions in a single LLM call.
   *
   * Falls back to individual extraction per item if the batch call fails,
   * so partial results are still usable.
   */
  async extractBatch(
    captures: RawActionCapture[]
  ): Promise<(IntentStep | PageBoundaryStep)[]> {
    if (captures.length === 0) return []
    if (captures.length === 1) {
      return [await this.extractIntent(captures[0])]
    }

    const messages = [
      { role: 'system' as const, content: INTENT_EXTRACTION_SYSTEM_PROMPT },
      { role: 'user' as const, content: buildBatchExtractionPrompt(captures) },
    ]

    try {
      const response = await this.provider.complete(messages, {
        temperature: 0.2,
        // Allow ~256 tokens per step
        maxTokens: 256 * captures.length,
      })
      const rawSteps = parseIntentBatchResponse(response, captures.length)
      return rawSteps.map(materialize)
    } catch {
      // Batch failed — fall back to sequential single calls
      return Promise.all(captures.map((c) => this.extractIntent(c)))
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildFallbackStep(capture: RawActionCapture, err: unknown): RawStep {
  if (capture.type === 'navigate') {
    return {
      type: 'page_boundary',
      expectedUrl: capture.url,
      waitCondition: 'networkIdle',
    }
  }

  const intent = synthesiseFallbackIntent(capture)
  return {
    type: 'action',
    intent,
    context_hint: capture.element
      ? `${capture.element.tag}${capture.element.text ? ` "${capture.element.text}"` : ''}`
      : capture.type,
    value: capture.value,
    verification: undefined,
    likelyNavigates:
      capture.type === 'click' &&
      !!capture.element &&
      ['a', 'button', 'input'].includes(capture.element.tag.toLowerCase()) &&
      capture.element.type !== 'checkbox' &&
      capture.element.type !== 'radio',
    // Attach error string for debugging — stripped from the output type but
    // visible during development if the caller logs the raw object
    ...(process.env.NODE_ENV !== 'production' && {
      _fallbackReason: String(err),
    }),
  } as RawIntentStep
}

function synthesiseFallbackIntent(capture: RawActionCapture): string {
  const el = capture.element
  switch (capture.type) {
    case 'click': {
      const label = el?.text || el?.ariaLabel || el?.placeholder || el?.tag || 'element'
      return `Click ${label}`
    }
    case 'type': {
      const label = el?.placeholder || el?.ariaLabel || el?.name || el?.tag || 'field'
      return `Enter value into ${label}`
    }
    case 'select': {
      const label = el?.name || el?.ariaLabel || el?.tag || 'dropdown'
      return `Select option from ${label}`
    }
    case 'scroll': {
      return 'Scroll page'
    }
    case 'navigate': {
      return capture.url ? `Navigate to ${capture.url}` : 'Navigate to page'
    }
    default:
      return `Perform ${capture.type} action`
  }
}
