import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkRecipeHealth, type HealthReport } from '../runtime/health-check'
import type { Recipe } from '@quokka/shared'

// Mock chrome.tabs.sendMessage
const mockSendMessage = vi.fn()

vi.mock('../lib/messaging', () => ({
  MessageType: {
    CHECK_SELECTOR: 'CHECK_SELECTOR',
    HEALTH_CHECK: 'HEALTH_CHECK',
  },
  sendToContent: (...args: unknown[]) => mockSendMessage(...args),
}))

function makeRecipe(steps: Recipe['steps']): Recipe {
  return {
    id: 'test-recipe',
    name: 'Test Recipe',
    version: '0.1.0',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hosts: ['example.com'],
    slots: [],
    guards: [],
    steps,
    meta: { createdFrom: 'code', tags: [] },
  }
}

describe('checkRecipeHealth', () => {
  beforeEach(() => {
    mockSendMessage.mockReset()
  })

  it('returns healthy when all selectors are found', async () => {
    const recipe = makeRecipe([
      { type: 'click', target: { css: '#btn' } },
      { type: 'type', target: { css: '#input' }, value: 'hello' },
    ])

    mockSendMessage
      .mockResolvedValueOnce({ found: true, count: 1, matchedVia: '#btn' })
      .mockResolvedValueOnce({ found: true, count: 1, matchedVia: '#input' })

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.overallStatus).toBe('healthy')
    expect(report.brokenCount).toBe(0)
    expect(report.steps).toHaveLength(2)
    expect(report.steps[0].status).toBe('ok')
    expect(report.steps[1].status).toBe('ok')
  })

  it('returns broken when selectors are not found', async () => {
    const recipe = makeRecipe([
      { type: 'click', target: { css: '#missing-btn' } },
    ])

    mockSendMessage.mockResolvedValue({ found: false, count: 0 })

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.overallStatus).toBe('broken')
    expect(report.brokenCount).toBe(1)
    expect(report.steps[0].status).toBe('not-found')
    expect(report.steps[0].selector).toBe('#missing-btn')
  })

  it('marks navigate steps as ok without checking', async () => {
    const recipe = makeRecipe([
      { type: 'navigate', url: 'https://example.com' },
    ])

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.overallStatus).toBe('healthy')
    expect(report.steps[0].status).toBe('ok')
    expect(report.steps[0].type).toBe('navigate')
    // sendToContent should not have been called for navigate
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('marks checkpoint steps as ok without checking', async () => {
    const recipe = makeRecipe([
      { type: 'checkpoint', message: 'Please confirm' },
    ])

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.overallStatus).toBe('healthy')
    expect(report.steps[0].status).toBe('ok')
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('reports warning when selector found via fallback', async () => {
    const recipe = makeRecipe([
      { type: 'click', target: { css: '#primary', fallbackSelectors: ['.fallback'] } },
    ])

    mockSendMessage.mockResolvedValue({ found: true, count: 1, matchedVia: '.fallback' })

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.overallStatus).toBe('warning')
    expect(report.steps[0].status).toBe('warning')
    expect(report.steps[0].message).toContain('fallback')
  })

  it('handles mixed results correctly', async () => {
    const recipe = makeRecipe([
      { type: 'navigate', url: 'https://example.com' },
      { type: 'click', target: { css: '#ok-btn' } },
      { type: 'click', target: { css: '#missing' } },
      { type: 'type', target: { css: '#input' }, value: 'test' },
    ])

    mockSendMessage
      .mockResolvedValueOnce({ found: true, count: 1, matchedVia: '#ok-btn' })
      .mockResolvedValueOnce({ found: false, count: 0 })
      .mockResolvedValueOnce({ found: true, count: 1, matchedVia: '#input' })

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.overallStatus).toBe('broken')
    expect(report.brokenCount).toBe(1)
    expect(report.steps[0].status).toBe('ok')     // navigate
    expect(report.steps[1].status).toBe('ok')     // found
    expect(report.steps[2].status).toBe('not-found') // missing
    expect(report.steps[3].status).toBe('ok')     // found
  })

  it('handles text-only locator as warning', async () => {
    const recipe = makeRecipe([
      { type: 'click', target: { text: 'Click me' } },
    ])

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.overallStatus).toBe('warning')
    expect(report.steps[0].status).toBe('warning')
    expect(report.steps[0].message).toContain('Text-only')
  })

  it('handles sendToContent error gracefully', async () => {
    const recipe = makeRecipe([
      { type: 'click', target: { css: '#btn' } },
    ])

    mockSendMessage.mockRejectedValue(new Error('Tab not found'))

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.overallStatus).toBe('broken')
    expect(report.steps[0].status).toBe('not-found')
    expect(report.steps[0].message).toContain('Tab not found')
  })

  it('reports correct counts for multiple elements', async () => {
    const recipe = makeRecipe([
      { type: 'extract', target: { css: '.item' }, as: 'items' },
    ])

    mockSendMessage.mockResolvedValue({ found: true, count: 5, matchedVia: '.item' })

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.steps[0].status).toBe('ok')
    expect(report.steps[0].message).toContain('5 elements')
  })

  it('checks wait steps like selector steps', async () => {
    const recipe = makeRecipe([
      { type: 'wait', target: { css: '#loader' } },
    ])

    mockSendMessage.mockResolvedValue({ found: true, count: 1, matchedVia: '#loader' })

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.steps[0].status).toBe('ok')
    expect(report.steps[0].type).toBe('wait')
  })

  it('returns healthy for empty recipe', async () => {
    const recipe = makeRecipe([])

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.overallStatus).toBe('healthy')
    expect(report.brokenCount).toBe(0)
    expect(report.steps).toHaveLength(0)
  })

  it('checks scroll, select, and hover steps', async () => {
    const recipe = makeRecipe([
      { type: 'scroll', target: { css: '#section' } },
      { type: 'select', target: { css: '#dropdown' }, value: 'opt1' },
      { type: 'hover', target: { css: '#tooltip' } },
    ])

    mockSendMessage.mockResolvedValue({ found: true, count: 1, matchedVia: '' })

    const report = await checkRecipeHealth(recipe, 1)

    expect(report.steps).toHaveLength(3)
    // All should have been checked (sendToContent called 3 times)
    expect(mockSendMessage).toHaveBeenCalledTimes(3)
  })

  it('uses testId in selector payload', async () => {
    const recipe = makeRecipe([
      { type: 'click', target: { testId: 'submit-btn' } },
    ])

    mockSendMessage.mockResolvedValue({ found: true, count: 1, matchedVia: '[data-testid="submit-btn"]' })

    await checkRecipeHealth(recipe, 42)

    expect(mockSendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        type: 'CHECK_SELECTOR',
        payload: expect.objectContaining({
          selector: '[data-testid="submit-btn"]',
        }),
      }),
    )
  })
})
