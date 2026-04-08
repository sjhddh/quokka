import { describe, it, expect, vi } from 'vitest'
import type { Guard, Recipe, RunEvent } from '@quokka/shared'
import type { BrowserBridge } from '../bridge.js'
import { RunEmitter } from '../emitter.js'
import { RecipeRunner } from '../runner.js'

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

function createTestRecipe(): Recipe {
  return {
    id: 'test-recipe',
    name: 'Test Recipe',
    version: '0.1.0',
    hosts: ['example.com'],
    slots: [{ key: 'url', label: 'URL', type: 'string' }],
    guards: [],
    steps: [
      { type: 'navigate', url: '{{url}}' },
      { type: 'click', target: { css: '#btn' } },
      { type: 'extract', target: { css: '.result' }, as: 'output' },
    ],
    meta: { createdFrom: 'code', tags: [] },
  }
}

describe('RecipeRunner', () => {
  it('runs a 3-step recipe and emits events', async () => {
    const bridge = createMockBridge()
    const emitter = new RunEmitter()
    const events: RunEvent[] = []

    emitter.on('run_started', (e) => events.push(e))
    emitter.on('step_started', (e) => events.push(e))
    emitter.on('step_succeeded', (e) => events.push(e))
    emitter.on('run_completed', (e) => events.push(e))

    const runner = new RecipeRunner(bridge, emitter)
    const recipe = createTestRecipe()
    const run = await runner.start(recipe, { url: 'https://example.com/page' })

    expect(run.status).toBe('completed')
    expect(run.finishedAt).toBeDefined()

    // run_started + 3x(step_started + step_succeeded) + run_completed = 8 events
    expect(events.length).toBe(8)
    expect(events[0].type).toBe('run_started')
    expect(events[1].type).toBe('step_started')
    expect(events[2].type).toBe('step_succeeded')
    expect(events[events.length - 1].type).toBe('run_completed')

    // Verify bridge was called with interpolated values
    expect(bridge.navigate).toHaveBeenCalledWith('https://example.com/page')
    expect(bridge.click).toHaveBeenCalledWith('#btn')
    expect(bridge.extract).toHaveBeenCalledWith('.result')
  })

  it('handles checkpoint with onCheckpoint callback', async () => {
    const bridge = createMockBridge()
    const emitter = new RunEmitter()
    const events: RunEvent[] = []

    emitter.on('checkpoint_required', (e) => events.push(e))
    emitter.on('checkpoint_approved', (e) => events.push(e))

    const recipe: Recipe = {
      id: 'cp-recipe',
      name: 'Checkpoint Recipe',
      version: '0.1.0',
      hosts: ['example.com'],
      slots: [],
      guards: [],
      steps: [
        { type: 'navigate', url: 'https://example.com' },
        { type: 'checkpoint', message: 'Continue?' },
        { type: 'click', target: { css: '#done' } },
      ],
      meta: { createdFrom: 'code', tags: [] },
    }

    const runner = new RecipeRunner(bridge, emitter, async () => true)
    const run = await runner.start(recipe, {})

    expect(run.status).toBe('completed')
    expect(events.some((e) => e.type === 'checkpoint_required')).toBe(true)
    expect(events.some((e) => e.type === 'checkpoint_approved')).toBe(true)
  })

  it('fails run when step errors', async () => {
    const bridge = createMockBridge()
    ;(bridge.click as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Element not found'))
    const emitter = new RunEmitter()
    const events: RunEvent[] = []

    emitter.on('step_failed', (e) => events.push(e))
    emitter.on('run_failed', (e) => events.push(e))

    const recipe: Recipe = {
      id: 'fail-recipe',
      name: 'Fail Recipe',
      version: '0.1.0',
      hosts: ['example.com'],
      slots: [],
      guards: [],
      steps: [{ type: 'click', target: { css: '#missing' } }],
      meta: { createdFrom: 'code', tags: [] },
    }

    const runner = new RecipeRunner(bridge, emitter)
    const run = await runner.start(recipe, {})

    expect(run.status).toBe('failed')
    expect(run.error).toBe('Element not found')
    expect(events.some((e) => e.type === 'step_failed')).toBe(true)
    expect(events.some((e) => e.type === 'run_failed')).toBe(true)
  })
})

describe('RecipeRunner guard enforcement', () => {
  it('completes run and emits guard_passed when guards pass', async () => {
    const bridge = createMockBridge()
    const emitter = new RunEmitter()
    const events: RunEvent[] = []

    emitter.on('guard_passed', (e) => events.push(e))
    emitter.on('run_completed', (e) => events.push(e))

    const recipe: Recipe = {
      ...createTestRecipe(),
      guards: [
        { type: 'url', expect: 'example.com', timeout: 5000 },
      ],
    }

    const runner = new RecipeRunner(bridge, emitter)
    const run = await runner.start(recipe, { url: 'https://example.com/page' })

    expect(run.status).toBe('completed')
    expect(events.some((e) => e.type === 'guard_passed')).toBe(true)
    expect(events.some((e) => e.type === 'run_completed')).toBe(true)
  })

  it('fails immediately and emits guard_failed when guards fail, no steps executed', async () => {
    const bridge = createMockBridge()
    ;(bridge.getUrl as ReturnType<typeof vi.fn>).mockResolvedValue('https://wrong-site.com')
    const emitter = new RunEmitter()
    const events: RunEvent[] = []

    emitter.on('guard_failed', (e) => events.push(e))
    emitter.on('run_failed', (e) => events.push(e))
    emitter.on('step_started', (e) => events.push(e))

    const recipe: Recipe = {
      ...createTestRecipe(),
      guards: [
        { type: 'url', expect: 'example.com', timeout: 5000 },
      ],
    }

    const runner = new RecipeRunner(bridge, emitter)
    const run = await runner.start(recipe, { url: 'https://example.com/page' })

    expect(run.status).toBe('failed')
    expect(run.error).toBe('Guard check failed')
    expect(events.some((e) => e.type === 'guard_failed')).toBe(true)
    expect(events.some((e) => e.type === 'run_failed')).toBe(true)
    // No steps should have been started
    expect(events.some((e) => e.type === 'step_started')).toBe(false)
    expect(bridge.navigate).not.toHaveBeenCalled()
    expect(bridge.click).not.toHaveBeenCalled()
  })

  it('skips guard checking when recipe has no guards (backward compatible)', async () => {
    const bridge = createMockBridge()
    const emitter = new RunEmitter()
    const events: RunEvent[] = []

    emitter.on('guard_passed', (e) => events.push(e))
    emitter.on('guard_failed', (e) => events.push(e))
    emitter.on('run_completed', (e) => events.push(e))

    const recipe = createTestRecipe() // guards: []

    const runner = new RecipeRunner(bridge, emitter)
    const run = await runner.start(recipe, { url: 'https://example.com/page' })

    expect(run.status).toBe('completed')
    // No guard events emitted
    expect(events.some((e) => e.type === 'guard_passed')).toBe(false)
    expect(events.some((e) => e.type === 'guard_failed')).toBe(false)
    // getUrl not called since no guards
    expect(bridge.getUrl).not.toHaveBeenCalled()
  })
})
