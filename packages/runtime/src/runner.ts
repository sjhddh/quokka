import type { Recipe, Run, RunEvent } from '@quokka/shared'
import type { BrowserBridge } from './bridge.js'
import { RunEmitter } from './emitter.js'
import { StepExecutor } from './executor.js'
import { transition } from './state-machine.js'

function makeEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function makeRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export class RecipeRunner {
  private executor: StepExecutor
  private currentRun: Run | null = null
  private checkpointResolve: ((approved: boolean) => void) | null = null

  constructor(
    private bridge: BrowserBridge,
    private emitter: RunEmitter,
    private onCheckpoint?: (message: string) => Promise<boolean> | boolean,
  ) {
    this.executor = new StepExecutor(bridge)
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

        const result = await this.executor.executeStep(step, slotValues)

        if (result.success) {
          this.emitEvent('step_succeeded', run, i, result.data ? { data: result.data } : undefined)
        } else {
          run.status = transition(run.status, 'error')
          run.error = result.error
          run.finishedAt = new Date().toISOString()
          this.emitEvent('step_failed', run, i, { error: result.error })
          this.emitEvent('run_failed', run)
          this.currentRun = run
          return run
        }
      }

      run.status = transition(run.status, 'complete')
      run.finishedAt = new Date().toISOString()
      this.emitEvent('run_completed', run)
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

  abort(): void {
    if (this.currentRun && this.currentRun.status !== 'completed' && this.currentRun.status !== 'failed') {
      this.currentRun.status = 'failed'
      this.currentRun.error = 'Aborted'
      this.currentRun.finishedAt = new Date().toISOString()
      if (this.checkpointResolve) {
        this.checkpointResolve(false)
        this.checkpointResolve = null
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
