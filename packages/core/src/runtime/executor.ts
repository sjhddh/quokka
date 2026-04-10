import type { Step, Locator } from '@quokka/shared'
import type { BrowserBridge } from './bridge.js'
import { buildSelectorChain } from './selector-fallback.js'
import { retryWithBackoff, type RetryConfig, DEFAULT_RETRY_CONFIG } from './failure-handler.js'

export interface StepResult {
  success: boolean
  data?: string
  error?: string
  /** Selectors that were attempted before success or final failure */
  fallbacksAttempted?: string[]
  /** The selector that ultimately worked (if any) */
  usedSelector?: string
}

function resolveLocator(locator: Locator): string {
  if (locator.css) return locator.css
  if (locator.testId) return `[data-testid="${locator.testId}"]`
  if (locator.ariaLabel) return `[aria-label="${locator.ariaLabel}"]`
  if (locator.text) return `:has-text("${locator.text}")`
  throw new Error('No valid locator strategy found')
}

function interpolate(value: string, slotValues: Record<string, string>): string {
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in slotValues) return slotValues[key]
    return `{{${key}}}`
  })
}

export class StepExecutor {
  private retryConfig: RetryConfig

  constructor(
    private bridge: BrowserBridge,
    retryConfig?: Partial<RetryConfig>,
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  }

  async executeStep(step: Step, slotValues: Record<string, string>): Promise<StepResult> {
    try {
      switch (step.type) {
        case 'click':
          return this.executeWithFallback(step.target, (sel) => this.bridge.click(sel))

        case 'type': {
          const value = interpolate(step.value, slotValues)
          return this.executeWithFallback(step.target, (sel) => this.bridge.type(sel, value))
        }

        case 'navigate': {
          const url = interpolate(step.url, slotValues)
          await this.bridge.navigate(url)
          return { success: true }
        }

        case 'extract':
          return this.executeExtractWithFallback(step.target)

        case 'wait': {
          const timeout = step.timeout
          return this.executeWithFallback(step.target, (sel) => this.bridge.waitFor(sel, timeout))
        }

        case 'checkpoint':
          return { success: true }

        default:
          return { success: false, error: `Unknown step type` }
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /**
   * Execute a selector-based operation with fallback chain + retries.
   */
  private async executeWithFallback(
    locator: Locator,
    operation: (selector: string) => Promise<void>,
  ): Promise<StepResult> {
    const result = await retryWithBackoff(locator, operation, this.retryConfig)

    if (result.ok) {
      return {
        success: true,
        usedSelector: result.usedSelector,
        fallbacksAttempted: result.attempt > 0 ? buildSelectorChain(locator) : undefined,
      }
    }

    return {
      success: false,
      error: result.failureContext.error,
      fallbacksAttempted: result.failureContext.fallbacksAttempted,
    }
  }

  /**
   * Extract requires returning data, so it has a slightly different flow.
   */
  private async executeExtractWithFallback(locator: Locator): Promise<StepResult> {
    const chain = buildSelectorChain(locator)
    const attempted: string[] = []

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.retryConfig.backoffMs[Math.min(attempt - 1, this.retryConfig.backoffMs.length - 1)]
        await new Promise((r) => setTimeout(r, delay))
      }

      for (const selector of chain) {
        if (!attempted.includes(selector)) attempted.push(selector)
        try {
          const data = await this.bridge.extract(selector)
          return {
            success: true,
            data,
            usedSelector: selector,
            fallbacksAttempted: attempt > 0 ? attempted : undefined,
          }
        } catch {
          // continue to next selector
        }
      }
    }

    return {
      success: false,
      error: 'All retries exhausted',
      fallbacksAttempted: attempted,
    }
  }
}
