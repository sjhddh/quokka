import { describe, it, expect, vi } from 'vitest'
import { tryWithFallbacks, retryWithBackoff, DEFAULT_RETRY_CONFIG } from '../runtime/failure-handler.js'

describe('tryWithFallbacks', () => {
  it('succeeds on primary selector', async () => {
    const op = vi.fn().mockResolvedValue(undefined)
    const result = await tryWithFallbacks({ css: '#btn' }, op)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.usedSelector).toBe('#btn')
    }
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('tries fallback selectors when primary fails', async () => {
    const op = vi.fn()
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce(undefined)

    const result = await tryWithFallbacks(
      { css: '#btn', fallbackSelectors: ['.fallback-btn'] },
      op,
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.usedSelector).toBe('.fallback-btn')
    }
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('returns failure context when all selectors fail', async () => {
    const op = vi.fn().mockRejectedValue(new Error('Element not found'))

    const result = await tryWithFallbacks(
      { css: '#btn', fallbackSelectors: ['.backup'] },
      op,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failureContext.fallbacksAttempted).toEqual(['#btn', '.backup'])
      expect(result.failureContext.error).toBe('Element not found')
    }
  })

  it('returns failure for empty locator', async () => {
    const op = vi.fn()
    const result = await tryWithFallbacks({}, op)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failureContext.error).toBe('No selectors available')
    }
  })
})

describe('retryWithBackoff', () => {
  it('succeeds on first attempt without retrying', async () => {
    const op = vi.fn().mockResolvedValue(undefined)
    const result = await retryWithBackoff(
      { css: '#btn' },
      op,
      { maxRetries: 3, backoffMs: [10, 20, 40] },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.attempt).toBe(0)
    }
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('retries and succeeds on later attempt', async () => {
    const op = vi.fn()
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce(undefined)

    const result = await retryWithBackoff(
      { css: '#btn' },
      op,
      { maxRetries: 2, backoffMs: [10, 20] },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.attempt).toBe(1)
    }
  })

  it('returns failure after all retries exhausted', async () => {
    const op = vi.fn().mockRejectedValue(new Error('always fails'))

    const result = await retryWithBackoff(
      { css: '#btn' },
      op,
      { maxRetries: 1, backoffMs: [10] },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.attempts).toBe(2) // initial + 1 retry
      expect(result.failureContext.error).toBe('always fails')
    }
  })

  it('respects zero maxRetries', async () => {
    const op = vi.fn().mockRejectedValue(new Error('fail'))

    const result = await retryWithBackoff(
      { css: '#btn' },
      op,
      { maxRetries: 0, backoffMs: [] },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.attempts).toBe(1) // just the initial attempt
    }
    expect(op).toHaveBeenCalledTimes(1)
  })
})
