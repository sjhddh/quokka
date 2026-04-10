import { describe, it, expect, beforeEach } from 'vitest'
import {
  IntentExtractor,
  parseIntentResponse,
  parseIntentBatchResponse,
  type RawActionCapture,
  type IntentStep,
  type PageBoundaryStep,
} from '../intent/intent-extractor.js'
import type { LLMProvider, ChatMessage, CompletionOptions } from '../providers/types.js'

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Creates a minimal RawActionCapture for testing */
function makeCapture(overrides: Partial<RawActionCapture> = {}): RawActionCapture {
  return {
    type: 'click',
    element: {
      tag: 'button',
      text: 'Submit',
      selector: '#submit-btn',
    },
    pageUrl: 'https://example.com/login',
    pageTitle: 'Login Page',
    timestamp: Date.now(),
    ...overrides,
  }
}

/** Mock LLM provider that returns configurable responses */
class TestLLMProvider implements LLMProvider {
  name = 'test-provider'
  responses: string[] = []
  callCount = 0

  constructor(responses?: string[]) {
    this.responses = responses ?? []
  }

  async complete(_messages: ChatMessage[], _options?: CompletionOptions): Promise<string> {
    const response = this.responses[this.callCount] ?? this.responses[this.responses.length - 1] ?? ''
    this.callCount++
    return response
  }

  async completeJSON<T>(_messages: ChatMessage[], _schema: Record<string, unknown>, _options?: CompletionOptions): Promise<T> {
    const text = await this.complete(_messages, _options)
    return JSON.parse(text) as T
  }
}

// ─── parseIntentResponse ─────────────────────────────────────────────────────

describe('parseIntentResponse', () => {
  it('parses a valid action step', () => {
    const json = JSON.stringify({
      type: 'action',
      intent: 'Click the Sign In button',
      context_hint: 'primary submit button on login form',
      likelyNavigates: true,
      verification: 'Dashboard page loads',
    })
    const result = parseIntentResponse(json)
    expect(result.type).toBe('action')
    expect((result as any).intent).toBe('Click the Sign In button')
    expect((result as any).likelyNavigates).toBe(true)
  })

  it('parses a valid page_boundary step', () => {
    const json = JSON.stringify({
      type: 'page_boundary',
      expectedUrl: 'https://example.com/dashboard',
      waitCondition: 'networkIdle',
    })
    const result = parseIntentResponse(json)
    expect(result.type).toBe('page_boundary')
    expect((result as any).waitCondition).toBe('networkIdle')
  })

  it('strips markdown code fences', () => {
    const fenced = '```json\n' + JSON.stringify({
      type: 'action',
      intent: 'Click button',
      context_hint: 'test',
      likelyNavigates: false,
    }) + '\n```'
    const result = parseIntentResponse(fenced)
    expect(result.type).toBe('action')
  })

  it('throws on invalid JSON', () => {
    expect(() => parseIntentResponse('not valid json {')).toThrow('invalid JSON')
  })

  it('throws on unknown type', () => {
    const json = JSON.stringify({ type: 'unknown_thing', foo: 'bar' })
    expect(() => parseIntentResponse(json)).toThrow('unknown type')
  })

  it('throws when action intent is empty', () => {
    const json = JSON.stringify({
      type: 'action',
      intent: '',
      context_hint: 'test',
      likelyNavigates: false,
    })
    expect(() => parseIntentResponse(json)).toThrow('"intent" must be a non-empty string')
  })

  it('falls back to "load" for invalid waitCondition', () => {
    const json = JSON.stringify({
      type: 'page_boundary',
      waitCondition: 'invalidValue',
    })
    const result = parseIntentResponse(json) as any
    expect(result.waitCondition).toBe('load')
  })

  it('coerces string "true" to boolean for likelyNavigates', () => {
    const json = JSON.stringify({
      type: 'action',
      intent: 'Click link',
      context_hint: '',
      likelyNavigates: 'true',
    })
    const result = parseIntentResponse(json) as any
    expect(result.likelyNavigates).toBe(true)
  })
})

// ─── parseIntentBatchResponse ────────────────────────────────────────────────

describe('parseIntentBatchResponse', () => {
  it('parses a valid batch of steps', () => {
    const items = [
      { type: 'action', intent: 'Enter username', context_hint: 'field', likelyNavigates: false },
      { type: 'action', intent: 'Click submit', context_hint: 'button', likelyNavigates: true },
    ]
    const result = parseIntentBatchResponse(JSON.stringify(items), 2)
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('action')
    expect(result[1].type).toBe('action')
  })

  it('throws when count does not match expectedCount', () => {
    const items = [
      { type: 'action', intent: 'Click', context_hint: '', likelyNavigates: false },
    ]
    expect(() => parseIntentBatchResponse(JSON.stringify(items), 3)).toThrow(
      'expected 3 items, got 1'
    )
  })

  it('throws on non-array JSON', () => {
    expect(() => parseIntentBatchResponse(JSON.stringify({ type: 'action' }), 1)).toThrow(
      'expected array'
    )
  })
})

// ─── IntentExtractor.extractIntent ───────────────────────────────────────────

describe('IntentExtractor.extractIntent', () => {
  it('returns a step with a generated id', async () => {
    const provider = new TestLLMProvider([
      JSON.stringify({
        type: 'action',
        intent: 'Click the Sign In button',
        context_hint: 'login form submit',
        likelyNavigates: true,
      }),
    ])

    const extractor = new IntentExtractor(provider)
    const step = await extractor.extractIntent(makeCapture())

    expect(step.id).toBeDefined()
    expect(step.id.length).toBeGreaterThan(0)
    expect(step.type).toBe('action')
    expect((step as IntentStep).intent).toBe('Click the Sign In button')
  })

  it('falls back gracefully when LLM returns garbage', async () => {
    const provider = new TestLLMProvider([
      'this is not JSON at all, just random garbage text!!!',
    ])

    const extractor = new IntentExtractor(provider)
    const step = await extractor.extractIntent(makeCapture({ type: 'click' }))

    // Should not throw — should produce a fallback step
    expect(step.id).toBeDefined()
    expect(step.type).toBe('action')
    // Fallback intent should be synthesized from the capture
    expect((step as IntentStep).intent).toContain('Click')
  })

  it('falls back gracefully when LLM returns invalid JSON structure', async () => {
    const provider = new TestLLMProvider([
      JSON.stringify({ nonsense: true, nothing: 'useful' }),
    ])

    const extractor = new IntentExtractor(provider)
    const step = await extractor.extractIntent(makeCapture({ type: 'type', value: 'hello' }))

    expect(step.id).toBeDefined()
    expect(step.type).toBe('action')
    expect((step as IntentStep).intent).toContain('Enter value')
  })

  it('produces a page_boundary fallback for navigate actions on LLM failure', async () => {
    const provider = new TestLLMProvider(['BROKEN'])

    const extractor = new IntentExtractor(provider)
    const step = await extractor.extractIntent(
      makeCapture({ type: 'navigate', url: 'https://example.com/next' })
    )

    expect(step.type).toBe('page_boundary')
    expect((step as PageBoundaryStep).expectedUrl).toBe('https://example.com/next')
  })

  it('calls the provider exactly once for a single extraction', async () => {
    const provider = new TestLLMProvider([
      JSON.stringify({
        type: 'action',
        intent: 'Click button',
        context_hint: 'btn',
        likelyNavigates: false,
      }),
    ])

    const extractor = new IntentExtractor(provider)
    await extractor.extractIntent(makeCapture())

    expect(provider.callCount).toBe(1)
  })
})

// ─── IntentExtractor.extractBatch ────────────────────────────────────────────

describe('IntentExtractor.extractBatch', () => {
  it('returns empty array for empty input', async () => {
    const provider = new TestLLMProvider([])
    const extractor = new IntentExtractor(provider)
    const result = await extractor.extractBatch([])
    expect(result).toEqual([])
    expect(provider.callCount).toBe(0)
  })

  it('delegates to extractIntent for single-item batch', async () => {
    const provider = new TestLLMProvider([
      JSON.stringify({
        type: 'action',
        intent: 'Click OK',
        context_hint: 'ok button',
        likelyNavigates: false,
      }),
    ])

    const extractor = new IntentExtractor(provider)
    const result = await extractor.extractBatch([makeCapture()])

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('action')
    expect(provider.callCount).toBe(1)
  })

  it('parses a multi-item batch response', async () => {
    const batchResponse = JSON.stringify([
      { type: 'action', intent: 'Enter email', context_hint: 'email field', likelyNavigates: false },
      { type: 'action', intent: 'Enter password', context_hint: 'password field', likelyNavigates: false },
      { type: 'action', intent: 'Click Sign In', context_hint: 'submit button', likelyNavigates: true },
    ])

    const provider = new TestLLMProvider([batchResponse])
    const extractor = new IntentExtractor(provider)

    const captures = [
      makeCapture({ type: 'type', value: 'user@test.com' }),
      makeCapture({ type: 'type', value: '{{credential_1}}' }),
      makeCapture({ type: 'click' }),
    ]

    const result = await extractor.extractBatch(captures)
    expect(result).toHaveLength(3)
    expect(result.every((s) => s.id.length > 0)).toBe(true)
  })

  it('falls back to sequential extraction when batch parse fails', async () => {
    // First call (batch) returns garbage, subsequent individual calls succeed
    const singleResponse = JSON.stringify({
      type: 'action',
      intent: 'Click item',
      context_hint: 'element',
      likelyNavigates: false,
    })

    const provider = new TestLLMProvider([
      'not valid batch json',  // batch call fails
      singleResponse,          // fallback call 1
      singleResponse,          // fallback call 2
    ])

    const extractor = new IntentExtractor(provider)
    const result = await extractor.extractBatch([makeCapture(), makeCapture()])

    // Should have fallen back: 1 batch call + 2 individual calls = 3
    expect(provider.callCount).toBe(3)
    expect(result).toHaveLength(2)
  })
})
