import type { Recipe, Step, Locator } from '@quokka/shared'
import { buildSelectorChain } from '@quokka/core/runtime'
import { resolveSelector } from './selector-utils'
import { MessageType, sendToContent, type CheckSelectorPayload, type CheckSelectorResult } from '../lib/messaging'

export interface StepHealth {
  index: number
  type: string
  status: 'ok' | 'warning' | 'not-found'
  selector?: string
  message: string
}

export interface HealthReport {
  steps: StepHealth[]
  overallStatus: 'healthy' | 'warning' | 'broken'
  brokenCount: number
}

const SELECTOR_STEP_TYPES = ['click', 'type', 'wait', 'extract', 'scroll', 'select', 'hover']

/**
 * Extract the primary CSS selector and fallback chain from a step's locator.
 */
function getSelectorsFromStep(step: Step): { primary: string; fallbacks: string[] } | null {
  if (!('target' in step) || !step.target) return null

  const locator = step.target as Locator
  const primary = resolveSelector(locator)
  const chain = buildSelectorChain(locator)

  // Filter out non-CSS-queryable selectors (XPath, :has-text pseudo)
  const isQueryable = (s: string) =>
    !s.startsWith('/') && !s.includes(':has-text(')

  // Fallbacks are everything in the chain except the primary, filtered to queryable
  const fallbacks = chain.filter((s) => s !== primary && isQueryable(s))

  return { primary, fallbacks }
}

/**
 * Check a single step's health by querying the content script for selector matches.
 */
async function checkStep(
  step: Step,
  index: number,
  tabId: number,
): Promise<StepHealth> {
  // Navigate steps: can't check without actually navigating
  if (step.type === 'navigate') {
    return {
      index,
      type: step.type,
      status: 'ok',
      message: `Navigate to ${step.url} (not checkable without navigating)`,
    }
  }

  // Checkpoint steps: always ok (no DOM dependency)
  if (step.type === 'checkpoint') {
    return {
      index,
      type: step.type,
      status: 'ok',
      message: 'Checkpoint (user confirmation)',
    }
  }

  // Steps that need a selector
  if (!SELECTOR_STEP_TYPES.includes(step.type)) {
    return {
      index,
      type: step.type,
      status: 'ok',
      message: `Step type "${step.type}" does not require a selector`,
    }
  }

  const selectors = getSelectorsFromStep(step)
  if (!selectors) {
    return {
      index,
      type: step.type,
      status: 'warning',
      message: 'No selector defined for this step',
    }
  }

  const { primary, fallbacks } = selectors

  // Text-only locator with no CSS selector
  if (!primary && fallbacks.length === 0) {
    const locator = (step as { target: Locator }).target
    if (locator.text) {
      return {
        index,
        type: step.type,
        status: 'warning',
        message: `Text-only locator "${locator.text}" (cannot verify without DOM text search)`,
      }
    }
    return {
      index,
      type: step.type,
      status: 'warning',
      message: 'No CSS selector available for this step',
    }
  }

  // Query the content script
  try {
    const payload: CheckSelectorPayload = {
      selector: primary || fallbacks[0] || '',
      fallbacks: primary ? fallbacks : fallbacks.slice(1),
    }

    const result = await sendToContent<CheckSelectorResult>(tabId, {
      type: MessageType.CHECK_SELECTOR,
      payload,
    })

    if (result.found) {
      const via = result.matchedVia !== primary && result.matchedVia
        ? ` (via fallback: ${result.matchedVia})`
        : ''
      return {
        index,
        type: step.type,
        status: via ? 'warning' : 'ok',
        selector: primary || result.matchedVia,
        message: `Found ${result.count} element${result.count !== 1 ? 's' : ''}${via}`,
      }
    }

    return {
      index,
      type: step.type,
      status: 'not-found',
      selector: primary,
      message: `Selector not found: ${primary || fallbacks[0]}`,
    }
  } catch (err) {
    return {
      index,
      type: step.type,
      status: 'not-found',
      selector: primary,
      message: `Could not check selector: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Run a dry-run health check on a recipe against the current page.
 * Checks whether each step's selector can resolve without executing any actions.
 */
export async function checkRecipeHealth(
  recipe: Recipe,
  tabId: number,
): Promise<HealthReport> {
  const steps: StepHealth[] = await Promise.all(
    recipe.steps.map((step, index) => checkStep(step, index, tabId)),
  )

  const brokenCount = steps.filter((s) => s.status === 'not-found').length
  const warningCount = steps.filter((s) => s.status === 'warning').length

  let overallStatus: HealthReport['overallStatus']
  if (brokenCount > 0) {
    overallStatus = 'broken'
  } else if (warningCount > 0) {
    overallStatus = 'warning'
  } else {
    overallStatus = 'healthy'
  }

  return { steps, overallStatus, brokenCount }
}
