import type { Step, Locator } from '@quokka/shared'
import type { BrowserBridge } from './bridge.js'
import { buildSelectorChain } from './selector-fallback.js'

export interface RetryConfig {
  /** Maximum number of retry attempts per step (default: 3) */
  maxRetries: number
  /** Backoff delays in ms for each retry (default: [1000, 2000, 4000]) */
  backoffMs: number[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: [1000, 2000, 4000],
}

export interface FailureContext {
  stepIndex: number
  stepType: string
  selector: string
  error: string
  fallbacksAttempted: string[]
  canRetry: boolean
}

export type PauseAction = 'retry' | 'skip' | 'fix'

/**
 * Attempt a bridge operation using the selector fallback chain.
 * Returns the first successful result, or a FailureContext if all fail.
 */
export async function tryWithFallbacks(
  locator: Locator,
  operation: (selector: string) => Promise<void>,
): Promise<{ ok: true; usedSelector: string } | { ok: false; failureContext: Pick<FailureContext, 'fallbacksAttempted' | 'error'> }> {
  const chain = buildSelectorChain(locator)
  const attempted: string[] = []
  let lastError = ''

  for (const selector of chain) {
    attempted.push(selector)
    try {
      await operation(selector)
      return { ok: true, usedSelector: selector }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  return {
    ok: false,
    failureContext: {
      fallbacksAttempted: attempted,
      error: lastError || 'No selectors available',
    },
  }
}

/**
 * Attempt an operation with exponential backoff retries.
 * Each attempt runs through the full fallback selector chain.
 */
export async function retryWithBackoff(
  locator: Locator,
  operation: (selector: string) => Promise<void>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<{ ok: true; usedSelector: string; attempt: number } | { ok: false; failureContext: Pick<FailureContext, 'fallbacksAttempted' | 'error'>; attempts: number }> {
  const allAttempted: string[] = []
  let lastError = ''

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = config.backoffMs[Math.min(attempt - 1, config.backoffMs.length - 1)]
      await sleep(delay)
    }

    const result = await tryWithFallbacks(locator, operation)
    if (result.ok) {
      return { ok: true, usedSelector: result.usedSelector, attempt }
    }

    lastError = result.failureContext.error
    // Collect attempted selectors (dedup across retries)
    for (const s of result.failureContext.fallbacksAttempted) {
      if (!allAttempted.includes(s)) allAttempted.push(s)
    }
  }

  return {
    ok: false,
    failureContext: {
      fallbacksAttempted: allAttempted,
      error: lastError || 'All retries exhausted',
    },
    attempts: config.maxRetries + 1,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Build a FailureContext for event emission.
 */
export function buildFailureContext(
  stepIndex: number,
  step: Step,
  selector: string,
  error: string,
  fallbacksAttempted: string[],
  canRetry: boolean,
): FailureContext {
  return {
    stepIndex,
    stepType: step.type,
    selector,
    error,
    fallbacksAttempted,
    canRetry,
  }
}
