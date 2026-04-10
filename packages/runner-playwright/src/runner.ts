/**
 * PlaywrightRunner — headless browser automation using Playwright.
 *
 * Implements the same execution flow as the Chrome extension replay:
 * 1. Launch browser
 * 2. Navigate to first page
 * 3. For each page phase (grouped by page_boundary):
 *    - Capture DOM snapshot
 *    - Check PlanCache for cached plan
 *    - On miss: call ExecutionPlanner.planPage()
 *    - Execute PlannedActions via Playwright
 *    - On failure: call ExecutionPlanner.handleFailure() for recovery
 *    - Wait for navigation on page_boundary
 * 4. Return RunResult
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import type { RecipeV2, ActionStep, PageBoundary } from '@quokka/shared'
import {
  ExecutionPlanner,
  PlanCache,
  MemoryPlanCacheStorage,
  type ModelProvider,
  type PlannedAction,
  type IntentStep,
} from '@quokka/core'

import type { RunnerOptions, RunResult, IRunner } from './types.js'
import { capturePlaywrightSnapshot } from './dom-capture.js'
import { executeAction } from './action-executor.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Group recipe steps into phases separated by page_boundary steps. */
function groupByPagePhases(
  steps: RecipeV2['steps'],
): Array<{ actions: ActionStep[]; boundary: PageBoundary | null }> {
  const phases: Array<{ actions: ActionStep[]; boundary: PageBoundary | null }> = []
  let currentActions: ActionStep[] = []

  for (const step of steps) {
    if (step.type === 'page_boundary') {
      phases.push({ actions: currentActions, boundary: step as PageBoundary })
      currentActions = []
    } else {
      currentActions.push(step as ActionStep)
    }
  }

  // Trailing actions after the last boundary (or all actions if no boundaries)
  if (currentActions.length > 0) {
    phases.push({ actions: currentActions, boundary: null })
  }

  return phases
}

/** Convert an ActionStep to the IntentStep shape expected by ExecutionPlanner. */
function toIntentStep(step: ActionStep): IntentStep {
  return {
    id: step.id,
    type: 'action',
    intent: step.intent,
    context_hint: step.context_hint ?? '',
    value: step.value,
    verification: step.verification,
    likelyNavigates: step.likelyNavigates,
  }
}

/** Map wait condition to Playwright's waitUntil value. */
function toWaitUntil(
  condition?: 'networkIdle' | 'domContentLoaded' | 'load',
): 'networkidle' | 'domcontentloaded' | 'load' {
  switch (condition) {
    case 'networkIdle': return 'networkidle'
    case 'domContentLoaded': return 'domcontentloaded'
    case 'load': return 'load'
    default: return 'domcontentloaded'
  }
}

// ─── PlaywrightRunner ────────────────────────────────────────────────────────

export class PlaywrightRunner implements IRunner {
  private options: Required<RunnerOptions>
  private browser: Browser | null = null
  private context: BrowserContext | null = null

  constructor(options: RunnerOptions = {}) {
    this.options = {
      headless: options.headless ?? true,
      slowMo: options.slowMo ?? 0,
      timeout: options.timeout ?? 30_000,
      viewport: options.viewport ?? { width: 1280, height: 720 },
      screenshotOnFailure: options.screenshotOnFailure ?? false,
      screenshotDir: options.screenshotDir ?? './screenshots',
    }
  }

  /**
   * Run a RecipeV2 end-to-end using Playwright.
   */
  async run(
    recipe: RecipeV2,
    variables: Record<string, string>,
    provider: ModelProvider,
  ): Promise<RunResult> {
    const start = Date.now()
    const screenshots: string[] = []
    let stepsExecuted = 0

    // Merge recipe-level variables with caller-provided overrides
    const mergedVars: Record<string, string> = {
      ...(recipe.variables ?? {}),
      ...variables,
    }

    // Count total action steps (exclude page_boundary steps from the count)
    const totalSteps = recipe.steps.filter((s) => s.type === 'action').length

    const planner = new ExecutionPlanner(provider)
    const cache = new PlanCache(new MemoryPlanCacheStorage())

    try {
      // ── Launch browser ──
      this.browser = await chromium.launch({
        headless: this.options.headless,
        slowMo: this.options.slowMo,
      })

      this.context = await this.browser.newContext({
        viewport: this.options.viewport,
      })

      const page = await this.context.newPage()
      page.setDefaultTimeout(this.options.timeout)

      // ── Determine start URL ──
      const startUrl = this.resolveStartUrl(recipe)
      if (startUrl) {
        await page.goto(startUrl, { waitUntil: 'domcontentloaded' })
      }

      // ── Execute phases ──
      const phases = groupByPagePhases(recipe.steps)

      for (const phase of phases) {
        if (phase.actions.length === 0 && phase.boundary) {
          // Pure navigation boundary with no preceding actions
          await this.waitForBoundary(page, phase.boundary)
          continue
        }

        // Capture DOM snapshot
        const snapshot = await capturePlaywrightSnapshot(page)

        // Check plan cache
        const intentSteps = phase.actions.map(toIntentStep)
        let plan = await cache.get(snapshot.url, snapshot.structuralHash)

        if (!plan) {
          // Cache miss — ask the LLM to plan
          plan = await planner.planPage(intentSteps, snapshot)
          await cache.set(plan)
        }

        // Execute each planned action
        for (let i = 0; i < plan.actions.length; i++) {
          let action = plan.actions[i]
          const intentStep = intentSteps.find((s) => s.id === action.stepId)

          const result = await executeAction(page, action, mergedVars, {
            timeout: this.options.timeout,
            screenshotOnFailure: this.options.screenshotOnFailure,
            screenshotDir: this.options.screenshotDir,
          })

          if (result.screenshot) {
            screenshots.push(result.screenshot)
          }

          if (!result.ok) {
            // Attempt recovery via the planner
            if (intentStep) {
              try {
                const freshSnapshot = await capturePlaywrightSnapshot(page)
                const recoveredAction = await planner.handleFailure(
                  action,
                  result.error ?? 'Unknown error',
                  freshSnapshot,
                  intentStep,
                )

                // Retry with recovered action
                const retryResult = await executeAction(
                  page,
                  recoveredAction,
                  mergedVars,
                  {
                    timeout: this.options.timeout,
                    screenshotOnFailure: this.options.screenshotOnFailure,
                    screenshotDir: this.options.screenshotDir,
                  },
                )

                if (retryResult.screenshot) {
                  screenshots.push(retryResult.screenshot)
                }

                if (!retryResult.ok) {
                  return {
                    status: 'failed',
                    stepsExecuted,
                    totalSteps,
                    duration: Date.now() - start,
                    error: `Step "${action.stepId}" failed after recovery: ${retryResult.error}`,
                    screenshots: screenshots.length > 0 ? screenshots : undefined,
                  }
                }
              } catch (recoveryErr) {
                return {
                  status: 'failed',
                  stepsExecuted,
                  totalSteps,
                  duration: Date.now() - start,
                  error: `Step "${action.stepId}" failed and recovery errored: ${recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr)}`,
                  screenshots: screenshots.length > 0 ? screenshots : undefined,
                }
              }
            } else {
              return {
                status: 'failed',
                stepsExecuted,
                totalSteps,
                duration: Date.now() - start,
                error: `Step "${action.stepId}" failed: ${result.error}`,
                screenshots: screenshots.length > 0 ? screenshots : undefined,
              }
            }
          }

          // Update cache confidence
          await cache.updateConfidence(
            snapshot.url,
            action.selector,
            true,
          )

          stepsExecuted++
        }

        // Wait for navigation if this phase ends with a boundary
        if (phase.boundary) {
          await this.waitForBoundary(page, phase.boundary)
        }
      }

      return {
        status: 'completed',
        stepsExecuted,
        totalSteps,
        duration: Date.now() - start,
        screenshots: screenshots.length > 0 ? screenshots : undefined,
      }
    } catch (err) {
      return {
        status: 'failed',
        stepsExecuted,
        totalSteps,
        duration: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        screenshots: screenshots.length > 0 ? screenshots : undefined,
      }
    }
  }

  /**
   * Close the browser and clean up resources.
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close()
      this.context = null
    }
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  // ── Private helpers ──

  /**
   * Resolve the start URL from the recipe.
   * Uses the first host in `hosts`, or the first navigate action's value,
   * or the first page_boundary's expectedUrl.
   */
  private resolveStartUrl(recipe: RecipeV2): string | null {
    // Prefer explicit hosts
    if (recipe.hosts && recipe.hosts.length > 0) {
      const host = recipe.hosts[0]
      return host.startsWith('http') ? host : `https://${host}`
    }

    // Look for a navigate action or page_boundary with an expectedUrl
    for (const step of recipe.steps) {
      if (step.type === 'action') {
        const actionStep = step as ActionStep
        if (
          actionStep.intent.toLowerCase().includes('navigate') &&
          actionStep.value
        ) {
          return actionStep.value
        }
      }
      if (step.type === 'page_boundary') {
        const boundary = step as PageBoundary
        if (boundary.expectedUrl) return boundary.expectedUrl
      }
    }

    return null
  }

  /**
   * Wait for a page boundary transition (navigation / load).
   */
  private async waitForBoundary(page: Page, boundary: PageBoundary): Promise<void> {
    const waitUntil = toWaitUntil(boundary.waitCondition)

    if (boundary.expectedUrl) {
      // Wait for the URL to match (with a timeout)
      try {
        await page.waitForURL(boundary.expectedUrl, {
          waitUntil,
          timeout: this.options.timeout,
        })
      } catch {
        // URL might not match exactly — fall back to waiting for load state
        await page.waitForLoadState(waitUntil)
      }
    } else {
      await page.waitForLoadState(waitUntil)
    }
  }
}
