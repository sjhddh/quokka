import type { RecipeV2Step, ActionStep, PageBoundary } from '@quokka/shared'
import type { PlannedAction } from '@quokka/core'
import type { StepCommand } from './content-executor'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PagePhase {
  /** The action steps to execute on this page */
  steps: ActionStep[]
  /** The page_boundary that follows this phase (undefined for the last phase) */
  boundary: PageBoundary | undefined
}

// ─── groupByPageBoundary ────────────────────────────────────────────────────

/**
 * Split a flat list of v2 steps into page phases at page_boundary markers.
 *
 * Each phase contains the action steps that run on one page, plus the
 * page_boundary step (if any) that terminates it. The last phase has no
 * boundary — those steps run to completion without triggering a navigation.
 *
 * Example:
 *   [action, action, boundary, action, boundary, action]
 *   → [{steps:[a,a], boundary:b1}, {steps:[a], boundary:b2}, {steps:[a], boundary:undefined}]
 */
export function groupByPageBoundary(steps: RecipeV2Step[]): PagePhase[] {
  const phases: PagePhase[] = []
  let current: ActionStep[] = []

  for (const step of steps) {
    if (step.type === 'action') {
      current.push(step)
    } else if (step.type === 'page_boundary') {
      phases.push({ steps: current, boundary: step })
      current = []
    }
  }

  // Push whatever remains as the final phase (no trailing boundary)
  if (current.length > 0 || phases.length === 0) {
    phases.push({ steps: current, boundary: undefined })
  }

  return phases
}

// ─── plannedActionToCommand ─────────────────────────────────────────────────

/**
 * Convert a PlannedAction (produced by ExecutionPlanner) into a StepCommand
 * understood by the existing content-executor. This bridges the v2 plan layer
 * into the v1 execution layer so we reuse executeStepCommand unchanged.
 *
 * Variable interpolation is handled downstream by content-executor's
 * `interpolate()`, so we pass variableValues through as slotValues.
 */
export function plannedActionToCommand(
  action: PlannedAction,
  variables: Record<string, string>,
): StepCommand {
  const locator = { css: action.selector }

  switch (action.action) {
    case 'click':
      return { type: 'click', locator, slotValues: variables }

    case 'type':
      return { type: 'type', locator, value: action.value ?? '', slotValues: variables }

    case 'select':
      // 'select' maps to 'type' in the content executor (sets .value on <select>)
      return { type: 'type', locator, value: action.value ?? '', slotValues: variables }

    case 'scroll':
      // Scroll is modelled as a click on the target element to bring it into view
      return { type: 'click', locator, slotValues: variables }

    case 'wait':
      return { type: 'wait', locator, timeout: 5000, slotValues: variables }

    case 'navigate':
      // navigate actions carry the URL in the value field
      return { type: 'navigate', url: action.value ?? '', slotValues: variables }

    default:
      // Defensive fallback — treat unknown actions as a click
      return { type: 'click', locator, slotValues: variables }
  }
}

// ─── waitForPageBoundary ────────────────────────────────────────────────────

/**
 * Wait for the navigation triggered by a page_boundary step to settle.
 *
 * Strategy:
 * 1. Poll until the tab's URL changes away from the current URL (or matches
 *    the expected URL pattern if provided).
 * 2. Then wait for the tab status to become 'complete'.
 *
 * This is intentionally simple — all we need is "new page is ready to snapshot".
 */
export async function waitForPageBoundary(
  boundary: PageBoundary,
  tabId: number,
): Promise<void> {
  const POLL_INTERVAL_MS = 200
  const TIMEOUT_MS = 30_000

  // Capture the URL at the moment we start waiting
  const initialTab = await chrome.tabs.get(tabId)
  const initialUrl = initialTab.url ?? ''

  const deadline = Date.now() + TIMEOUT_MS

  // Phase 1: wait for URL to change (or match expectedUrl)
  await new Promise<void>((resolve, reject) => {
    const check = async () => {
      if (Date.now() > deadline) {
        reject(new Error(`waitForPageBoundary: timed out waiting for navigation (tabId=${tabId})`))
        return
      }

      let tab: chrome.tabs.Tab
      try {
        tab = await chrome.tabs.get(tabId)
      } catch (err) {
        reject(new Error(`waitForPageBoundary: tab ${tabId} disappeared — ${err}`))
        return
      }

      const currentUrl = tab.url ?? ''

      const urlChanged = currentUrl !== initialUrl && !currentUrl.startsWith('about:')

      const urlMatches = boundary.expectedUrl
        ? currentUrl.includes(boundary.expectedUrl) || new RegExp(boundary.expectedUrl).test(currentUrl)
        : true

      if (urlChanged && urlMatches) {
        resolve()
        return
      }

      setTimeout(check, POLL_INTERVAL_MS)
    }

    setTimeout(check, POLL_INTERVAL_MS)
  })

  // Phase 2: wait for tab.status === 'complete'
  await new Promise<void>((resolve, reject) => {
    const timeLeft = deadline - Date.now()
    if (timeLeft <= 0) {
      reject(new Error(`waitForPageBoundary: timed out before tab finished loading`))
      return
    }

    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error(`waitForPageBoundary: timed out waiting for tab to finish loading`))
    }, timeLeft)

    const listener = (
      updatedTabId: number,
      changeInfo: { status?: string },
    ) => {
      if (updatedTabId !== tabId) return
      if (changeInfo.status === 'complete') {
        clearTimeout(timeout)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }

    chrome.tabs.onUpdated.addListener(listener)
  })

  // Brief additional settle for networkIdle condition
  if (boundary.waitCondition === 'networkIdle') {
    await sleep(800)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
