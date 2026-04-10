import { describe, it, expect } from 'vitest'
import { buildSelectorChain } from '../runtime/selector-fallback.js'

describe('buildSelectorChain', () => {
  it('returns CSS selector as primary', () => {
    const chain = buildSelectorChain({ css: '#submit' })
    expect(chain[0]).toBe('#submit')
  })

  it('returns testId selector when no css', () => {
    const chain = buildSelectorChain({ testId: 'btn-submit' })
    expect(chain[0]).toBe('[data-testid="btn-submit"]')
  })

  it('returns ariaLabel selector when no css or testId', () => {
    const chain = buildSelectorChain({ ariaLabel: 'Submit form' })
    expect(chain[0]).toBe('[aria-label="Submit form"]')
  })

  it('returns text selector when no other strategies', () => {
    const chain = buildSelectorChain({ text: 'Submit' })
    expect(chain[0]).toBe(':has-text("Submit")')
  })

  it('includes fallbackSelectors from locator', () => {
    const chain = buildSelectorChain({
      css: '#submit',
      fallbackSelectors: ['[aria-label="Submit"]', '.btn-primary'],
    })
    expect(chain).toContain('#submit')
    expect(chain).toContain('[aria-label="Submit"]')
    expect(chain).toContain('.btn-primary')
  })

  it('deduplicates selectors', () => {
    const chain = buildSelectorChain({
      css: '#submit',
      ariaLabel: 'Submit',
      fallbackSelectors: ['#submit', '[aria-label="Submit"]'],
    })
    const unique = new Set(chain)
    expect(chain.length).toBe(unique.size)
  })

  it('includes cross-strategy alternatives', () => {
    const chain = buildSelectorChain({
      css: '#submit',
      ariaLabel: 'Submit form',
      text: 'Submit',
    })
    expect(chain).toContain('#submit')
    expect(chain).toContain('[aria-label="Submit form"]')
    expect(chain).toContain(':has-text("Submit")')
  })

  it('returns empty array for empty locator', () => {
    const chain = buildSelectorChain({})
    expect(chain).toEqual([])
  })
})
