import { describe, it, expect, vi } from 'vitest'
import type { Recipe, RunEvent } from '@quokka/shared'
import type { BrowserBridge } from '../runtime/bridge.js'
import { RunEmitter } from '../runtime/emitter.js'
import { RecipeRunner, type PauseContext } from '../runtime/runner.js'
import type { PauseAction } from '../runtime/failure-handler.js'

function createMockBridge(): BrowserBridge {
  return {
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn().mockResolvedValue(undefined),
    extract: vi.fn().mockResolvedValue('extracted-data'),
    waitFor: vi.fn().mockResolvedValue(undefined),
    getUrl: vi.fn().mockResolvedValue('https://example.com'),
    getTextContent: vi.fn().mockResolvedValue('text content'),
  }
}

function createFailRecipe(): Recipe {
  return {
    id: 'fail-recipe',
    name: 'Fail Recipe',
    version: '0.1.0',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hosts: ['example.com'],
    slots: [],
    guards: [],
    steps: [
      { type: 'click', target: { css: '#step1' } },
      { type: 'click', target: { css: '#missing' } },
      { type: 'click', target: { css: '#step3' } },
    ],
    meta: { createdFrom: 'code', tags: [] },
  }
}

function createSingleStepRecipe(): Recipe {
  return {
    id: 'test',
    name: 'Test',
    version: '0.1.0',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hosts: ['example.com'],
    slots: [],
    guards: [],
    steps: [{ type: 'click', target: { css: '#missing' } }],
    meta: { createdFrom: 'code', tags: [] },
  }
}

describe('Pause-and-recover flow', () => {
  it('pauses on failure and resumes with retry', async () => {
    const bridge = createMockBridge()
    let callCount = 0
    ;(bridge.click as ReturnType<typeof vi.fn>).mockImplementation(async (sel: string) => {
      if (sel === '#missing') {
        callCount++
        if (callCount <= 1) throw new Error('Element not found')
        // Succeed on retry
        return
      }
    })

    const emitter = new RunEmitter()
    const events: RunEvent[] = []
    emitter.on('step_paused', (e) => events.push(e))
    emitter.on('step_retrying', (e) => events.push(e))
    emitter.on('run_completed', (e) => events.push(e))

    const runner = new RecipeRunner(
      bridge, emitter,
      undefined,
      async (): Promise<PauseAction> => 'retry',
      { maxRetries: 0, backoffMs: [] },
    )

    const run = await runner.start(createFailRecipe(), {})

    expect(run.status).toBe('completed')
    expect(events.some((e) => e.type === 'step_paused')).toBe(true)
    expect(events.some((e) => e.type === 'step_retrying')).toBe(true)
    expect(events.some((e) => e.type === 'run_completed')).toBe(true)
  })

  it('pauses on failure and resumes with skip', async () => {
    const bridge = createMockBridge()
    ;(bridge.click as ReturnType<typeof vi.fn>).mockImplementation(async (sel: string) => {
      if (sel === '#missing') throw new Error('Element not found')
    })

    const emitter = new RunEmitter()
    const events: RunEvent[] = []
    emitter.on('step_paused', (e) => events.push(e))
    emitter.on('step_succeeded', (e) => events.push(e))
    emitter.on('run_completed', (e) => events.push(e))

    const runner = new RecipeRunner(
      bridge, emitter,
      undefined,
      async (): Promise<PauseAction> => 'skip',
      { maxRetries: 0, backoffMs: [] },
    )

    const run = await runner.start(createFailRecipe(), {})

    expect(run.status).toBe('completed')
    expect(events.some((e) => e.type === 'step_paused')).toBe(true)
    // Step 2 was skipped, step 3 still ran
    expect(bridge.click).toHaveBeenCalledWith('#step3')
  })

  it('emits step_failed before pausing', async () => {
    const bridge = createMockBridge()
    ;(bridge.click as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not found'))

    const emitter = new RunEmitter()
    const events: RunEvent[] = []
    emitter.on('step_failed', (e) => events.push(e))
    emitter.on('step_paused', (e) => events.push(e))

    const runner = new RecipeRunner(
      bridge, emitter,
      undefined,
      async (): Promise<PauseAction> => 'skip',
      { maxRetries: 0, backoffMs: [] },
    )

    await runner.start(createSingleStepRecipe(), {})

    // step_failed should come before step_paused
    const failIdx = events.findIndex((e) => e.type === 'step_failed')
    const pauseIdx = events.findIndex((e) => e.type === 'step_paused')
    expect(failIdx).toBeLessThan(pauseIdx)
  })

  it('provides correct pause context', async () => {
    const bridge = createMockBridge()
    ;(bridge.click as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Element not found'))

    const emitter = new RunEmitter()
    let capturedContext: PauseContext | null = null

    const runner = new RecipeRunner(
      bridge, emitter,
      undefined,
      async (ctx): Promise<PauseAction> => {
        capturedContext = ctx
        return 'skip'
      },
      { maxRetries: 0, backoffMs: [] },
    )

    await runner.start(createSingleStepRecipe(), {})

    expect(capturedContext).not.toBeNull()
    expect(capturedContext!.stepIndex).toBe(0)
    expect(capturedContext!.stepType).toBe('click')
    expect(capturedContext!.error).toBe('Element not found')
    expect(capturedContext!.options).toEqual(['retry', 'skip', 'fix'])
  })

  it('fails run when retry also fails', async () => {
    const bridge = createMockBridge()
    ;(bridge.click as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('still broken'))

    const emitter = new RunEmitter()
    const events: RunEvent[] = []
    emitter.on('run_failed', (e) => events.push(e))

    const runner = new RecipeRunner(
      bridge, emitter,
      undefined,
      async (): Promise<PauseAction> => 'retry',
      { maxRetries: 0, backoffMs: [] },
    )

    const run = await runner.start(createSingleStepRecipe(), {})

    expect(run.status).toBe('failed')
    expect(events.some((e) => e.type === 'run_failed')).toBe(true)
  })

  it('falls back to immediate failure when no pause handler', async () => {
    const bridge = createMockBridge()
    ;(bridge.click as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not found'))

    const emitter = new RunEmitter()
    const runner = new RecipeRunner(bridge, emitter)

    const run = await runner.start(createSingleStepRecipe(), {})

    // Without onStepPaused, should fail immediately (backward compatible)
    expect(run.status).toBe('failed')
  })
})
