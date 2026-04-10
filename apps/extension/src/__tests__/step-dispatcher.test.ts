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

function makeCallbacks(
  stepResults: StepResult[] = [{ ok: true }],
  checkpointResult = true,
): { callbacks: ReplayCallbacks; events: string[]; executedCommands: unknown[] } {
  const events: string[] = []
  const executedCommands: unknown[] = []
  let stepIndex = 0

  const callbacks: ReplayCallbacks = {
    onEvent: (event) => events.push(event.type),
    onCheckpoint: vi.fn().mockResolvedValue(checkpointResult),
    executeStep: vi.fn().mockImplementation(async (_tabId, cmd) => {
      executedCommands.push(cmd)
      return stepResults[stepIndex++] ?? { ok: true }
    }),
  }
  return { callbacks, events, executedCommands }
}

describe('dispatchReplay', () => {
  describe('selector resolution via stepToCommand', () => {
    it('resolves CSS selector for click steps', async () => {
      const recipe = makeRecipe([
        { type: 'click', target: { css: '#submit-btn' } },
      ])
      const { callbacks, executedCommands } = makeCallbacks()

      await dispatchReplay(recipe, {}, 1, callbacks)

      expect(executedCommands).toHaveLength(1)
      expect(executedCommands[0]).toMatchObject({
        type: 'click',
        locator: { css: '#submit-btn' },
      })
    })

    it('resolves testId-based locator for click steps', async () => {
      const recipe = makeRecipe([
        { type: 'click', target: { testId: 'login-button' } },
      ])
      const { callbacks, executedCommands } = makeCallbacks()

      await dispatchReplay(recipe, {}, 1, callbacks)

      expect(executedCommands[0]).toMatchObject({
        type: 'click',
        locator: { testId: 'login-button' },
      })
    })

    it('resolves ariaLabel-based locator', async () => {
      const recipe = makeRecipe([
        { type: 'click', target: { ariaLabel: 'Close dialog' } },
      ])
      const { callbacks, executedCommands } = makeCallbacks()

      await dispatchReplay(recipe, {}, 1, callbacks)

      expect(executedCommands[0]).toMatchObject({
        type: 'click',
        locator: { ariaLabel: 'Close dialog' },
      })
    })

    it('resolves text-based locator', async () => {
      const recipe = makeRecipe([
        { type: 'click', target: { text: 'Submit' } },
      ])
      const { callbacks, executedCommands } = makeCallbacks()

      await dispatchReplay(recipe, {}, 1, callbacks)

      expect(executedCommands[0]).toMatchObject({
        type: 'click',
        locator: { text: 'Submit' },
      })
    })

    it('passes locator with fallbackSelectors through to executor', async () => {
      const recipe = makeRecipe([
        {
          type: 'click',
          target: {
            css: '#main-btn',
            testId: 'btn',
            fallbackSelectors: ['button.primary', '.btn-main'],
          },
        },
      ])
      const { callbacks, executedCommands } = makeCallbacks()

      await dispatchReplay(recipe, {}, 1, callbacks)

      expect(executedCommands[0]).toMatchObject({
        type: 'click',
        locator: {
          css: '#main-btn',
          testId: 'btn',
          fallbackSelectors: ['button.primary', '.btn-main'],
        },
      })
    })
  })

  describe('slot interpolation', () => {
    it('passes slotValues to type command', async () => {
      const recipe = makeRecipe([
        { type: 'type', target: { css: '#email' }, value: '{{email}}' },
      ])
      const { callbacks, executedCommands } = makeCallbacks()

      await dispatchReplay(recipe, { email: 'test@example.com' }, 1, callbacks)

      expect(executedCommands[0]).toMatchObject({
        type: 'type',
        locator: { css: '#email' },
        value: '{{email}}',
        slotValues: { email: 'test@example.com' },
      })
    })

    it('passes slotValues to navigate command', async () => {
      const recipe = makeRecipe([
        { type: 'navigate', url: 'https://example.com/{{path}}' },
      ])
      const { callbacks, executedCommands } = makeCallbacks()

      await dispatchReplay(recipe, { path: 'dashboard' }, 1, callbacks)

      expect(executedCommands[0]).toMatchObject({
        type: 'navigate',
        url: 'https://example.com/{{path}}',
        slotValues: { path: 'dashboard' },
      })
    })
  })

  describe('step execution flow', () => {
    it('runs all steps and returns completed run', async () => {
      const recipe = makeRecipe([
        { type: 'click', target: { css: '#btn1' } },
        { type: 'click', target: { css: '#btn2' } },
      ])
      const { callbacks, events } = makeCallbacks([{ ok: true }, { ok: true }])

      const run = await dispatchReplay(recipe, {}, 1, callbacks)

      expect(run.status).toBe('completed')
      expect(events).toContain('run_started')
      expect(events).toContain('run_completed')
      expect(events.filter((e) => e === 'step_started')).toHaveLength(2)
      expect(events.filter((e) => e === 'step_succeeded')).toHaveLength(2)
    })

    it('stops and returns failed run on step failure', async () => {
      const recipe = makeRecipe([
        { type: 'click', target: { css: '#btn1' } },
        { type: 'click', target: { css: '#btn2' } },
      ])
      const { callbacks, events } = makeCallbacks([
        { ok: false, error: 'Element not found' },
        { ok: true },
      ])

      const run = await dispatchReplay(recipe, {}, 1, callbacks)

      expect(run.status).toBe('failed')
      expect(run.error).toBe('Element not found')
      expect(events).toContain('step_failed')
      expect(events).toContain('run_failed')
      // Second step should not have been attempted
      expect(callbacks.executeStep).toHaveBeenCalledTimes(1)
    })

    it('handles checkpoint approval', async () => {
      const recipe = makeRecipe([
        { type: 'checkpoint', message: 'Are you sure?' },
        { type: 'click', target: { css: '#confirm' } },
      ])
      const { callbacks, events } = makeCallbacks([{ ok: true }], true)

      const run = await dispatchReplay(recipe, {}, 1, callbacks)

      expect(run.status).toBe('completed')
      expect(callbacks.onCheckpoint).toHaveBeenCalledWith('Are you sure?')
      expect(events).toContain('checkpoint_required')
      expect(events).toContain('checkpoint_approved')
    })

    it('handles checkpoint rejection', async () => {
      const recipe = makeRecipe([
        { type: 'checkpoint', message: 'Proceed?' },
        { type: 'click', target: { css: '#confirm' } },
      ])
      const { callbacks, events } = makeCallbacks([{ ok: true }], false)

      const run = await dispatchReplay(recipe, {}, 1, callbacks)

      expect(run.status).toBe('failed')
      expect(run.error).toBe('Checkpoint rejected')
      expect(events).toContain('checkpoint_rejected')
      expect(events).toContain('run_failed')
      // Click step should not have been attempted
      expect(callbacks.executeStep).not.toHaveBeenCalled()
    })
  })

  describe('step type mapping', () => {
    it('maps wait step with timeout', async () => {
      const recipe = makeRecipe([
        { type: 'wait', target: { css: '.loading' }, timeout: 3000 },
      ])
      const { callbacks, executedCommands } = makeCallbacks()

      await dispatchReplay(recipe, {}, 1, callbacks)

      expect(executedCommands[0]).toMatchObject({
        type: 'wait',
        locator: { css: '.loading' },
        timeout: 3000,
      })
    })

    it('maps extract step', async () => {
      const recipe = makeRecipe([
        { type: 'extract', target: { css: '#price' }, as: 'total' },
      ])
      const { callbacks, executedCommands } = makeCallbacks([{ ok: true, data: '$42' }])

      const run = await dispatchReplay(recipe, {}, 1, callbacks)

      expect(executedCommands[0]).toMatchObject({
        type: 'extract',
        locator: { css: '#price' },
      })
      expect(run.status).toBe('completed')
    })

    it('maps navigate step', async () => {
      const recipe = makeRecipe([
        { type: 'navigate', url: 'https://example.com/page' },
      ])
      const { callbacks, executedCommands } = makeCallbacks()

      await dispatchReplay(recipe, {}, 1, callbacks)

      expect(executedCommands[0]).toMatchObject({
        type: 'navigate',
        url: 'https://example.com/page',
      })
    })
  })
})
