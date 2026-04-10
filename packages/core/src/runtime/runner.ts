import type { Recipe, Run, RunEvent } from '@quokka/shared'
import type { BrowserBridge } from './bridge.js'
import { RunEmitter } from './emitter.js'
import { StepExecutor } from './executor.js'
import type { StepResult } from './executor.js'
import { checkGuards } from './guard-checker.js'
import { transition } from './state-machine.js'
import type { RetryConfig } from './failure-handler.js'
import type { PauseAction } from './failure-handler.js'

function makeEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function makeRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export interface PauseContext {
  stepIndex: number
  stepType: string
  selector: string
  error: string
  fallbacksAttempted: string[]
  options: PauseAction[]
}

export class RecipeRunner {
  private executor: StepExecutor
  private currentRun: Run | null = null
  private checkpointResolve: ((approved: boolean) => void) | null = null
  private pauseResolve: ((action: PauseAction) => void) | null = null

  constructor(
    private bridge: BrowserBridge,
    private emitter: RunEmitter,
    private onCheckpoint?: (message: string) => Promise<boolean> | boolean,
    private onStepPaused?: (context: PauseContext) => Promise<PauseAction> | PauseAction,
    retryConfig?: Partial<RetryConfig>,
  ) {
    // When pause-and-recover is enabled, use retries. Otherwise, no retries (backward compatible).
    const effectiveConfig = retryConfig ?? (onStepPaused ? undefined : { maxRetries: 0, backoffMs: [] })
    this.executor = new StepExecutor(bridge, effectiveConfig)
  }

  async start(recipe: Recipe, slotValues: Record<string, string>): Promise<Run> {
    const run: Run = {
      id: makeRunId(),
      recipeId: recipe.id,
      status: 'idle',
      slotValues,
      currentStepIndex: 0,
      startedAt: new Date().toISOString(),
    }

    this.currentRun = run

    // idle -> planning -> running
    run.status = transition(run.status, 'start')
    run.status = transition(run.status, 'plan_complete')

    this.emitEvent('run_started', run)

    try {
      // Guard enforcement: check preconditions before executing any steps
      if (recipe.guards && recipe.guards.length > 0) {
        const guardResult = await checkGuards(recipe.guards, this.bridge)
        if (!guardResult.passed) {
          run.status = transition(run.status, 'error')
          run.error = 'Guard check failed'
          run.finishedAt = new Date().toISOString()
          this.emitEvent('guard_failed', run, undefined, { results: guardResult.results })
          this.emitEvent('run_failed', run)
          this.currentRun = run
          return run
        }
        this.emitEvent('guard_passed', run, undefined, { results: guardResult.results })
      }

      for (let i = 0; i < recipe.steps.length; i++) {
        if (this.currentRun.status === 'failed') break

        run.currentStepIndex = i
        const step = recipe.steps[i]

        if (step.type === 'checkpoint') {
          run.status = transition(run.status, 'checkpoint')
          this.emitEvent('checkpoint_required', run, i, { message: step.message })

          const approved = await this.waitForCheckpoint(step.message)
          if (approved) {
            run.status = transition(run.status, 'approve')
            this.emitEvent('checkpoint_approved', run, i)
          } else {
            run.status = transition(run.status, 'reject')
            run.error = 'Checkpoint rejected'
            run.finishedAt = new Date().toISOString()
            this.emitEvent('checkpoint_rejected', run, i)
            this.emitEvent('run_failed', run)
            this.currentRun = run
            return run
          }
          continue
        }

        this.emitEvent('step_started', run, i)

        let result = await this.executor.executeStep(step, slotValues)

        if (result.success) {
          this.emitEvent('step_succeeded', run, i, buildStepPayload(result))
          continue
        }

        // Step failed after all retries and fallbacks — enter pause-and-recover
        const selector = result.usedSelector ?? ''
        const failPayload = {
          error: result.error,
          fallbacksAttempted: result.fallbacksAttempted ?? [],
          canRetry: true,
        }

        this.emitEvent('step_failed', run, i, failPayload)

        // If no pause handler is configured, fail immediately (backward compatible)
        if (!this.onStepPaused) {
          run.status = transition(run.status, 'error')
          run.error = result.error
          run.finishedAt = new Date().toISOString()
          this.emitEvent('run_failed', run)
          this.currentRun = run
          return run
        }

        // Pause the run instead of aborting
        run.status = transition(run.status, 'pause')
        const pauseContext: PauseContext = {
          stepIndex: i,
          stepType: step.type,
          selector,
          error: result.error ?? 'Unknown error',
          fallbacksAttempted: result.fallbacksAttempted ?? [],
          options: ['retry', 'skip', 'fix'],
        }

        this.emitEvent('step_paused', run, i, pauseContext)

        const action = await this.waitForPauseAction(pauseContext)

        if (action === 'retry') {
          run.status = transition(run.status, 'retry')
          this.emitEvent('step_retrying', run, i)

          // Re-execute the step
          result = await this.executor.executeStep(step, slotValues)
          if (result.success) {
            this.emitEvent('step_succeeded', run, i, buildStepPayload(result))
            continue
          }

          // Still failed after manual retry — abort
          run.status = transition(run.status, 'error')
          run.error = result.error
          run.finishedAt = new Date().toISOString()
          this.emitEvent('step_failed', run, i, { error: result.error })
          this.emitEvent('run_failed', run)
          this.currentRun = run
          return run
        }

        if (action === 'skip') {
          run.status = transition(run.status, 'skip')
          this.emitEvent('step_succeeded', run, i, { skipped: true })
          continue
        }

        // 'fix' — not implemented yet, treat as abort
        run.status = transition(run.status, 'error')
        run.error = 'Fix action not yet supported'
        run.finishedAt = new Date().toISOString()
        this.emitEvent('run_failed', run)
        this.currentRun = run
        return run
      }

      if (run.status !== 'failed') {
        run.status = transition(run.status, 'complete')
        run.finishedAt = new Date().toISOString()
        this.emitEvent('run_completed', run)
      }
    } catch (err) {
      run.status = 'failed'
      run.error = err instanceof Error ? err.message : String(err)
      run.finishedAt = new Date().toISOString()
      this.emitEvent('run_failed', run)
    }

    this.currentRun = run
    return run
  }

  resume(): void {
    if (this.checkpointResolve) {
      this.checkpointResolve(true)
      this.checkpointResolve = null
    }
  }

  /** Resolve a paused step with an action */
  resolvePause(action: PauseAction): void {
    if (this.pauseResolve) {
      this.pauseResolve(action)
      this.pauseResolve = null
    }
  }

  abort(): void {
    if (this.currentRun && this.currentRun.status !== 'completed' && this.currentRun.status !== 'failed') {
      this.currentRun.status = 'failed'
      this.currentRun.error = 'Aborted'
      this.currentRun.finishedAt = new Date().toISOString()
      if (this.checkpointResolve) {
        this.checkpointResolve(false)
        this.checkpointResolve = null
      }
      if (this.pauseResolve) {
        this.pauseResolve('skip')
        this.pauseResolve = null
      }
      this.emitEvent('run_failed', this.currentRun)
    }
  }

  private async waitForCheckpoint(message: string): Promise<boolean> {
    if (this.onCheckpoint) {
      return this.onCheckpoint(message)
    }
    return new Promise<boolean>((resolve) => {
      this.checkpointResolve = resolve
    })
  }

  private async waitForPauseAction(context: PauseContext): Promise<PauseAction> {
    if (this.onStepPaused) {
      return this.onStepPaused(context)
    }
    return new Promise<PauseAction>((resolve) => {
      this.pauseResolve = resolve
    })
  }

  private emitEvent(
    type: RunEvent['type'],
    run: Run,
    stepIndex?: number,
    payload?: unknown,
  ): void {
    const event: RunEvent = {
      id: makeEventId(),
      runId: run.id,
      type,
      stepIndex,
      payload,
      timestamp: new Date().toISOString(),
    }
    this.emitter.emit(type, event)
  }
}

function buildStepPayload(result: { data?: string; usedSelector?: string; skipped?: boolean }): Record<string, unknown> | undefined {
  const payload: Record<string, unknown> = {}
  if (result.data) payload.data = result.data
  if (result.usedSelector) payload.usedSelector = result.usedSelector
  if ('skipped' in result) payload.skipped = result.skipped
  return Object.keys(payload).length > 0 ? payload : undefined
}
