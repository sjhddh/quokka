import type { Recipe, RunEvent } from '@quokka/shared'
import type { Run } from '@quokka/shared'
import { RecipeRunner } from '../runtime/runner.js'
import { RunEmitter } from '../runtime/emitter.js'
import { chromium } from 'playwright'
import { PlaywrightBridge } from './playwright-bridge.js'

export interface HeadlessOptions {
  onEvent?: (event: RunEvent) => void
  timeout?: number
}

export interface HeadlessResult {
  status: 'completed' | 'failed'
  events: RunEvent[]
  error?: string
  run: Run
}

export async function runHeadless(
  recipe: Recipe,
  slotValues: Record<string, string>,
  options?: HeadlessOptions,
): Promise<HeadlessResult> {
  const events: RunEvent[] = []
  const emitter = new RunEmitter()

  // Listen to all event types
  const eventTypes = [
    'run_started',
    'step_started',
    'step_succeeded',
    'step_failed',
    'checkpoint_required',
    'checkpoint_approved',
    'checkpoint_rejected',
    'guard_passed',
    'guard_failed',
    'run_completed',
    'run_failed',
  ] as const

  for (const type of eventTypes) {
    emitter.on(type, (event: RunEvent) => {
      events.push(event)
      options?.onEvent?.(event)
    })
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    if (options?.timeout) {
      page.setDefaultTimeout(options.timeout)
    }

    const bridge = new PlaywrightBridge(page)
    // Auto-approve checkpoints in headless mode
    const runner = new RecipeRunner(bridge, emitter, async () => true)
    const run = await runner.start(recipe, slotValues)

    return {
      status: run.status === 'completed' ? 'completed' : 'failed',
      events,
      error: run.error,
      run,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return {
      status: 'failed',
      events,
      error,
      run: {
        id: '',
        recipeId: recipe.id,
        status: 'failed',
        slotValues,
        currentStepIndex: 0,
        error,
        finishedAt: new Date().toISOString(),
      },
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
