import { describe, it, expect, vi } from 'vitest'
import { dispatchReplay, type ReplayCallbacks } from '../runtime/step-dispatcher'
import type { Recipe, Step } from '@quokka/shared'
import type { StepResult } from '../runtime/content-executor'

function makeRecipe(steps: Step[], overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'test-recipe',
    name: 'Test Recipe',
    version: '0.1.0',
    schemaVersion: 1,
    hosts: ['example.com'],
    slots: [],
    guards: [],
    steps,
    meta: { createdFrom: 'code', tags: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// Mock chrome.tabs.get for URL condition tests
const mockChromeTabsGet = vi.fn()
vi.stubGlobal('chrome', {
  tabs: {
    get: mockChromeTabsGet,
  },
})

function makeCallbacks(
  stepHandler?: (tabId: number, cmd: unknown) => StepResult,
): { callbacks: ReplayCallbacks; events: Array<{ type: string; payload?: unknown }> } {
  const events: Array<{ type: string; payload?: unknown }> = []

  const callbacks: ReplayCallbacks = {
    onEvent: (event) => events.push({ type: event.type, payload: event.payload }),
    onCheckpoint: vi.fn().mockResolvedValue(true),
    executeStep: vi.fn().mockImplementation(async (_tabId, cmd) => {
      if (stepHandler) return stepHandler(_tabId, cmd)
      return { ok: true }
    }),
  }
  return { callbacks, events }
}

describe('conditional step execution', () => {
  it('executes thenSteps when element_exists condition is true', async () => {
    const recipe = makeRecipe([
      {
        type: 'conditional',
        condition: { type: 'element_exists', target: { css: '#logged-in' } },
        thenSteps: [{ type: 'click', target: { css: '#dashboard' } }],
        elseSteps: [{ type: 'click', target: { css: '#login' } }],
      },
    ])

    const { callbacks, events } = makeCallbacks((_tabId, cmd) => {
      const c = cmd as { type: string; locator?: { css?: string } }
      if (c.type === 'check_selector') return { ok: true, data: 'true' }
      return { ok: true }
    })

    const run = await dispatchReplay(recipe, {}, 1, callbacks)

    expect(run.status).toBe('completed')
    // Should have: condition_evaluated, step_started (for click #dashboard), step_succeeded
    const condEval = events.find((e) => e.type === 'condition_evaluated')
    expect(condEval).toBeDefined()
    expect((condEval!.payload as { result: boolean }).result).toBe(true)

    // Check that #dashboard was clicked, not #login
    const executeCalls = (callbacks.executeStep as ReturnType<typeof vi.fn>).mock.calls
    const clickCalls = executeCalls.filter(
      (c: unknown[]) => (c[1] as { type: string }).type === 'click',
    )
    expect(clickCalls).toHaveLength(1)
    expect((clickCalls[0][1] as { locator: { css: string } }).locator.css).toBe('#dashboard')
  })

  it('executes elseSteps when element_exists condition is false', async () => {
    const recipe = makeRecipe([
      {
        type: 'conditional',
        condition: { type: 'element_exists', target: { css: '#logged-in' } },
        thenSteps: [{ type: 'click', target: { css: '#dashboard' } }],
        elseSteps: [{ type: 'click', target: { css: '#login' } }],
      },
    ])

    const { callbacks, events } = makeCallbacks((_tabId, cmd) => {
      const c = cmd as { type: string }
      if (c.type === 'check_selector') return { ok: true, data: 'false' }
      return { ok: true }
    })

    const run = await dispatchReplay(recipe, {}, 1, callbacks)

    expect(run.status).toBe('completed')
    const condEval = events.find((e) => e.type === 'condition_evaluated')
    expect((condEval!.payload as { result: boolean }).result).toBe(false)

    const executeCalls = (callbacks.executeStep as ReturnType<typeof vi.fn>).mock.calls
    const clickCalls = executeCalls.filter(
      (c: unknown[]) => (c[1] as { type: string }).type === 'click',
    )
    expect(clickCalls).toHaveLength(1)
    expect((clickCalls[0][1] as { locator: { css: string } }).locator.css).toBe('#login')
  })

  it('executes thenSteps when element_not_exists condition passes', async () => {
    const recipe = makeRecipe([
      {
        type: 'conditional',
        condition: { type: 'element_not_exists', target: { css: '.error-banner' } },
        thenSteps: [{ type: 'click', target: { css: '#proceed' } }],
      },
    ])

    const { callbacks } = makeCallbacks((_tabId, cmd) => {
      const c = cmd as { type: string }
      if (c.type === 'check_selector') return { ok: true, data: 'false' } // element not found
      return { ok: true }
    })

    const run = await dispatchReplay(recipe, {}, 1, callbacks)

    expect(run.status).toBe('completed')
    const executeCalls = (callbacks.executeStep as ReturnType<typeof vi.fn>).mock.calls
    const clickCalls = executeCalls.filter(
      (c: unknown[]) => (c[1] as { type: string }).type === 'click',
    )
    expect(clickCalls).toHaveLength(1)
  })

  it('skips branch when no elseSteps and condition is false', async () => {
    const recipe = makeRecipe([
      {
        type: 'conditional',
        condition: { type: 'element_exists', target: { css: '#popup' } },
        thenSteps: [{ type: 'click', target: { css: '#dismiss' } }],
        // no elseSteps
      },
      { type: 'click', target: { css: '#main-action' } },
    ])

    const { callbacks } = makeCallbacks((_tabId, cmd) => {
      const c = cmd as { type: string }
      if (c.type === 'check_selector') return { ok: true, data: 'false' }
      return { ok: true }
    })

    const run = await dispatchReplay(recipe, {}, 1, callbacks)

    expect(run.status).toBe('completed')
    const executeCalls = (callbacks.executeStep as ReturnType<typeof vi.fn>).mock.calls
    const clickCalls = executeCalls.filter(
      (c: unknown[]) => (c[1] as { type: string }).type === 'click',
    )
    // Only #main-action, not #dismiss
    expect(clickCalls).toHaveLength(1)
    expect((clickCalls[0][1] as { locator: { css: string } }).locator.css).toBe('#main-action')
  })

  it('evaluates url_matches condition', async () => {
    mockChromeTabsGet.mockResolvedValue({ url: 'https://example.com/dashboard' })

    const recipe = makeRecipe([
      {
        type: 'conditional',
        condition: { type: 'url_matches', pattern: '/dashboard' },
        thenSteps: [{ type: 'click', target: { css: '#already-there' } }],
        elseSteps: [{ type: 'navigate', url: 'https://example.com/dashboard' }],
      },
    ])

    const { callbacks } = makeCallbacks(() => ({ ok: true }))

    const run = await dispatchReplay(recipe, {}, 1, callbacks)

    expect(run.status).toBe('completed')
    const executeCalls = (callbacks.executeStep as ReturnType<typeof vi.fn>).mock.calls
    // Should run thenSteps (click #already-there), not navigate
    const clickCalls = executeCalls.filter(
      (c: unknown[]) => (c[1] as { type: string }).type === 'click',
    )
    expect(clickCalls).toHaveLength(1)
  })

  it('handles failure in conditional branch', async () => {
    const recipe = makeRecipe([
      {
        type: 'conditional',
        condition: { type: 'element_exists', target: { css: '#x' } },
        thenSteps: [{ type: 'click', target: { css: '#broken' } }],
      },
    ])

    const { callbacks } = makeCallbacks((_tabId, cmd) => {
      const c = cmd as { type: string }
      if (c.type === 'check_selector') return { ok: true, data: 'true' }
      return { ok: false, error: 'Element not found' }
    })

    const run = await dispatchReplay(recipe, {}, 1, callbacks)

    expect(run.status).toBe('failed')
    expect(run.error).toBe('Element not found')
  })
})
