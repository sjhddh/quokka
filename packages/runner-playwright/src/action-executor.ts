/**
 * Executes PlannedActions via Playwright page methods.
 */

import type { Page } from 'playwright'
import type { PlannedAction } from '@quokka/core'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'

// ─── Variable substitution ───────────────────────────────────────────────────

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g

/**
 * Replace `{{varName}}` placeholders in a string with values from the variables map.
 * Unmatched placeholders are left as-is.
 */
function substituteVariables(
  text: string,
  variables: Record<string, string>,
): string {
  return text.replace(VARIABLE_PATTERN, (match, name: string) => {
    return variables[name] ?? match
  })
}

// ─── Action execution ────────────────────────────────────────────────────────

export interface ActionExecutorOptions {
  /** Per-action timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Capture screenshot on failure */
  screenshotOnFailure?: boolean
  /** Directory for failure screenshots */
  screenshotDir?: string
}

export interface ActionResult {
  ok: boolean
  error?: string
  screenshot?: string
}

/**
 * Execute a single PlannedAction on a Playwright page.
 *
 * Maps action types to Playwright methods:
 * - click    → page.click()
 * - type     → page.fill()
 * - select   → page.selectOption()
 * - scroll   → page.evaluate(window.scrollBy / element.scrollIntoView)
 * - wait     → page.waitForSelector()
 * - navigate → page.goto()
 */
export async function executeAction(
  page: Page,
  action: PlannedAction,
  variables: Record<string, string>,
  options: ActionExecutorOptions = {},
): Promise<ActionResult> {
  const timeout = options.timeout ?? 30_000
  const selector = action.selector
  const value = action.value
    ? substituteVariables(action.value, variables)
    : undefined

  try {
    switch (action.action) {
      case 'click': {
        await page.click(selector, { timeout })
        break
      }

      case 'type': {
        // Clear existing value then fill
        await page.fill(selector, value ?? '', { timeout })
        break
      }

      case 'select': {
        await page.selectOption(selector, value ?? '', { timeout })
        break
      }

      case 'scroll': {
        if (selector === 'window' || selector === 'document') {
          // Scroll the page itself
          const delta = parseInt(value ?? '500', 10)
          await page.evaluate((dy: number) => window.scrollBy(0, dy), delta)
        } else {
          // Scroll a specific element into view
          await page.locator(selector).scrollIntoViewIfNeeded({ timeout })
        }
        break
      }

      case 'wait': {
        await page.waitForSelector(selector, {
          state: 'visible',
          timeout,
        })
        break
      }

      case 'navigate': {
        const url = value ?? selector
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout,
        })
        break
      }

      default: {
        return {
          ok: false,
          error: `Unknown action type: ${(action as PlannedAction).action}`,
        }
      }
    }

    return { ok: true }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    let screenshot: string | undefined

    if (options.screenshotOnFailure) {
      screenshot = await captureFailureScreenshot(
        page,
        action,
        options.screenshotDir ?? './screenshots',
      )
    }

    return {
      ok: false,
      error: errorMessage,
      screenshot,
    }
  }
}

// ─── Failure screenshot helper ───────────────────────────────────────────────

async function captureFailureScreenshot(
  page: Page,
  action: PlannedAction,
  screenshotDir: string,
): Promise<string | undefined> {
  try {
    await mkdir(screenshotDir, { recursive: true })
    const timestamp = Date.now()
    const safeName = action.stepId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filePath = join(screenshotDir, `failure-${safeName}-${timestamp}.png`)
    await page.screenshot({ path: filePath, fullPage: true })
    return filePath
  } catch {
    // Screenshot capture is best-effort — don't let it mask the real error
    return undefined
  }
}
