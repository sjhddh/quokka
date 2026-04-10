/**
 * v2-dispatcher.ts — Intent-based replay orchestrator for RecipeV2.
 *
 * Works alongside step-dispatcher.ts (v1). The v1 flow is NOT touched.
 *
 * Flow per page phase:
 *   1. Request DOM snapshot from content script via CAPTURE_PAGE_SNAPSHOT
 *   2. Check PlanCache (keyed by structural hash)
 *   3. On cache miss: call ExecutionPlanner.planPage() via LLM
 *   4. Execute PlannedActions sequentially via the existing EXECUTE_STEP path
 *   5. On action failure: call ExecutionPlanner.handleFailure() for recovery
 *   6. On page_boundary: waitForPageBoundary(), then advance to next phase
 */

import type { RecipeV2, Run, RunEvent } from '@quokka/shared'
import { ExecutionPlanner, PlanCache, MemoryPlanCacheStorage } from '@quokka/core'
import type { PlannedAction, PageSnapshot } from '@quokka/core'
import type { IntentStep } from '@quokka/core'
import { MessageType, type PageSnapshotResultPayload } from '../lib/messaging'
import type { StepResult } from './content-executor'
import { groupByPageBoundary, plannedActionToCommand, waitForPageBoundary } from './v2-helpers'
import type { ReplayCallbacks } from './step-dispatcher'
import type { ModelProvider } from '@quokka/core'

// ─── Types ──────────────────────────────────────────────────────────────────

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Dispatch a v2 (intent-based) recipe for replay.
 *
 * @param recipe        The RecipeV2 to execute
 * @param variableValues  Slot/variable substitution map
 * @param tabId         Chrome tab to operate on
 * @param callbacks     Same callback shape as v1 dispatchReplay
 * @param provider      ModelProvider instance (OpenAICompatibleProvider or similar)
 */
export async function dispatchV2Replay(
  recipe: RecipeV2,
  variableValues: Record<string, string>,
  tabId: number,
  callbacks: ReplayCallbacks,
  provider: ModelProvider,
): Promise<Run> {
  const run: Run = {
    id: makeId('run'),
    recipeId: recipe.id,
    status: 'running',
    slotValues: variableValues,
    currentStepIndex: 0,
    startedAt: new Date().toISOString(),
  }

  emitEvent(callbacks, 'run_started', run)

  const planner = new ExecutionPlanner(provider)
  const cache = new PlanCache(new MemoryPlanCacheStorage())

  const phases = groupByPageBoundary(recipe.steps)

  try {
    let globalStepIndex = 0

    for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
      const phase = phases[phaseIndex]

      // Skip empty phases (e.g. two consecutive page_boundary steps)
      if (phase.steps.length === 0) {
        if (phase.boundary) {
          await waitForPageBoundary(phase.boundary, tabId)
        }
        continue
      }

      // ── 1. Capture DOM snapshot ──────────────────────────────────────────
      let snapshot: PageSnapshot
      try {
        snapshot = await captureSnapshot(tabId)
      } catch (err) {
        throw new Error(
          `[v2-dispatcher] phase ${phaseIndex}: failed to capture DOM snapshot — ${err instanceof Error ? err.message : String(err)}`
        )
      }

      // ── 2. Plan (cache-first) ─────────────────────────────────────────────
      let actions: PlannedAction[]
      const cachedPlan = await cache.get(snapshot.url, snapshot.structuralHash)

      if (cachedPlan) {
        actions = cachedPlan.actions
      } else {
        // Convert ActionSteps to IntentSteps for the planner
        const intentSteps: IntentStep[] = phase.steps.map((s) => ({
          id: s.id,
          type: 'action' as const,
          intent: s.intent,
          context_hint: s.context_hint ?? '',
          value: s.value,
          verification: s.verification,
          likelyNavigates: s.likelyNavigates ?? false,
        }))

        let plan
        try {
          plan = await planner.planPage(intentSteps, snapshot)
        } catch (err) {
          throw new Error(
            `[v2-dispatcher] phase ${phaseIndex}: planning failed — ${err instanceof Error ? err.message : String(err)}`
          )
        }

        await cache.set(plan)
        actions = plan.actions
      }

      // ── 3. Execute actions sequentially ──────────────────────────────────
      for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
        let action = actions[actionIndex]
        run.currentStepIndex = globalStepIndex

        emitEvent(callbacks, 'step_started', run, globalStepIndex)

        const cmd = plannedActionToCommand(action, variableValues)
        let result: StepResult = await callbacks.executeStep(tabId, cmd)

        // ── 4. Recovery on failure ──────────────────────────────────────────
        if (!result.ok) {
          // Find the matching IntentStep for this action (by stepId)
          const originalStep = phase.steps.find((s) => s.id === action.stepId)

          if (originalStep) {
            try {
              const freshSnapshot = await captureSnapshot(tabId)
              const intentStep: IntentStep = {
                id: originalStep.id,
                type: 'action' as const,
                intent: originalStep.intent,
                context_hint: originalStep.context_hint ?? '',
                value: originalStep.value,
                verification: originalStep.verification,
                likelyNavigates: originalStep.likelyNavigates ?? false,
              }

              const recovered = await planner.handleFailure(
                action,
                result.error ?? 'unknown error',
                freshSnapshot,
                intentStep,
              )

              // Retry with recovered action
              const recoveryCmd = plannedActionToCommand(recovered, variableValues)
              result = await callbacks.executeStep(tabId, recoveryCmd)
              if (result.ok) {
                action = recovered
              }
            } catch (recoveryErr) {
              // Recovery failed — treat original failure as terminal
              result = {
                ok: false,
                error: `[v2-dispatcher] recovery failed: ${recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr)}`,
              }
            }
          }
        }

        // ── 5. Record outcome ─────────────────────────────────────────────
        if (result.ok) {
          await cache.updateConfidence(snapshot.url, action.selector, true)
          emitEvent(callbacks, 'step_succeeded', run, globalStepIndex)
        } else {
          await cache.updateConfidence(snapshot.url, action.selector, false)
          run.status = 'failed'
          run.error = result.error
          run.finishedAt = new Date().toISOString()
          emitEvent(callbacks, 'step_failed', run, globalStepIndex, { error: result.error })
          emitEvent(callbacks, 'run_failed', run)
          return run
        }

        globalStepIndex++
      }

      // ── 6. Handle page boundary ───────────────────────────────────────────
      if (phase.boundary) {
        try {
          await waitForPageBoundary(phase.boundary, tabId)
        } catch (err) {
          throw new Error(
            `[v2-dispatcher] phase ${phaseIndex}: navigation wait failed — ${err instanceof Error ? err.message : String(err)}`
          )
        }
      }
    }

    run.status = 'completed'
    run.finishedAt = new Date().toISOString()
    emitEvent(callbacks, 'run_completed', run)
  } catch (err) {
    run.status = 'failed'
    run.error = err instanceof Error ? err.message : String(err)
    run.finishedAt = new Date().toISOString()
    emitEvent(callbacks, 'run_failed', run)
  }

  return run
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Ask the content script to capture and return a PageSnapshot.
 */
async function captureSnapshot(tabId: number): Promise<PageSnapshot> {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: MessageType.CAPTURE_PAGE_SNAPSHOT,
  }) as PageSnapshotResultPayload | { ok: false; error: string }

  if ('ok' in response && !response.ok) {
    throw new Error((response as { ok: false; error: string }).error)
  }

  return (response as PageSnapshotResultPayload).snapshot
}

function emitEvent(
  callbacks: ReplayCallbacks,
  type: RunEvent['type'],
  run: Run,
  stepIndex?: number,
  payload?: unknown,
): void {
  callbacks.onEvent({
    id: makeId('evt'),
    runId: run.id,
    type,
    stepIndex,
    payload,
    timestamp: new Date().toISOString(),
  })
}
