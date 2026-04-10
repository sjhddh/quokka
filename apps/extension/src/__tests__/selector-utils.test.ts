import { describe, it, expect, beforeEach } from 'vitest'
import { resolveSelector, findElement, waitForElement, interpolate, tryFallbackChain } from '../runtime/selector-utils'

describe('resolveSelector', () => {
  it('returns css selector when present', () => {
    expect(resolveSelector({ css: '#my-id' })).toBe('#my-id')
  })

  it('returns testId selector', () => {
    expect(resolveSelector({ testId: 'submit-btn' })).toBe('[data-testid="submit-btn"]')
  })

  it('returns ariaLabel selector', () => {
    expect(resolveSelector({ ariaLabel: 'Close' })).toBe('[aria-label="Close"]')
  })

  it('returns empty string for text-only locator', () => {
    expect(resolveSelector({ text: 'Click me' })).toBe('')
  })

  it('returns empty string for empty locator', () => {
    expect(resolveSelector({})).toBe('')
  })

  it('prioritizes css over testId', () => {
    expect(resolveSelector({ css: '.btn', testId: 'btn' })).toBe('.btn')
  })

  it('prioritizes testId over ariaLabel', () => {
    expect(resolveSelector({ testId: 'btn', ariaLabel: 'Button' })).toBe('[data-testid="btn"]')
  })
})

describe('findElement', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('finds by CSS selector', () => {
    document.body.innerHTML = '<button id="test-btn">Click</button>'
    const el = findElement({ css: '#test-btn' })
    expect(el).not.toBeNull()
    expect(el?.id).toBe('test-btn')
  })

  it('finds by testId', () => {
    document.body.innerHTML = '<input data-testid="email-input" />'
    const el = findElement({ testId: 'email-input' })
    expect(el).not.toBeNull()
    expect(el?.getAttribute('data-testid')).toBe('email-input')
  })

  it('finds by ariaLabel', () => {
    document.body.innerHTML = '<button aria-label="Submit form">Go</button>'
    const el = findElement({ ariaLabel: 'Submit form' })
    expect(el).not.toBeNull()
  })

  it('finds by text content', () => {
    document.body.innerHTML = '<span>Hello World</span>'
    const el = findElement({ text: 'Hello World' })
    expect(el).not.toBeNull()
    expect(el?.textContent).toBe('Hello World')
  })

  it('returns null when nothing matches', () => {
    document.body.innerHTML = '<div>Nothing here</div>'
    const el = findElement({ css: '#nonexistent' })
    expect(el).toBeNull()
  })

  it('falls back to text when CSS does not match', () => {
    document.body.innerHTML = '<button class="btn">Submit</button>'
    const el = findElement({ css: '#wrong', text: 'Submit' })
    // CSS fails, then falls back to text content match
    expect(el).not.toBeNull()
    expect(el?.textContent).toBe('Submit')
  })

  it('uses text match for text-only locator', () => {
    document.body.innerHTML = '<a>Sign In</a>'
    const el = findElement({ text: 'Sign In' })
    expect(el).not.toBeNull()
    expect(el?.tagName).toBe('A')
  })
})

describe('waitForElement', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('resolves immediately if element exists', async () => {
    document.body.innerHTML = '<div id="ready">Ready</div>'
    const el = await waitForElement({ css: '#ready' }, 1000)
    expect(el.id).toBe('ready')
  })

  it('waits for element to appear', async () => {
    setTimeout(() => {
      const el = document.createElement('div')
      el.id = 'delayed'
      document.body.appendChild(el)
    }, 100)

    const el = await waitForElement({ css: '#delayed' }, 2000, 50)
    expect(el.id).toBe('delayed')
  })

  it('rejects on timeout', async () => {
    await expect(
      waitForElement({ css: '#never' }, 200, 50)
    ).rejects.toThrow('Timed out')
  })
})

describe('tryFallbackChain', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('finds element via fallbackSelectors when primary css fails', () => {
    document.body.innerHTML = '<button aria-label="Submit">Go</button>'
    const el = tryFallbackChain({
      css: '#nonexistent',
      fallbackSelectors: ['[aria-label="Submit"]'],
    })
    expect(el).not.toBeNull()
    expect(el?.getAttribute('aria-label')).toBe('Submit')
  })

  it('returns null when no selectors match', () => {
    document.body.innerHTML = '<div>nothing</div>'
    const el = tryFallbackChain({
      css: '#nope',
      fallbackSelectors: ['.also-nope'],
    })
    expect(el).toBeNull()
  })

  it('skips XPath selectors gracefully', () => {
    document.body.innerHTML = '<span>text</span>'
    const el = tryFallbackChain({
      fallbackSelectors: ['//*[contains(text(),"text")]', 'span'],
    })
    // XPath is skipped, but 'span' should match
    expect(el).not.toBeNull()
    expect(el?.tagName).toBe('SPAN')
  })

  it('skips :has-text pseudo selectors gracefully', () => {
    document.body.innerHTML = '<button>Click</button>'
    const el = tryFallbackChain({
      text: 'Click',
      fallbackSelectors: ['button'],
    })
    expect(el).not.toBeNull()
  })

  it('returns first matching selector in chain order', () => {
    document.body.innerHTML = '<button class="btn" data-testid="go">Go</button>'
    const el = tryFallbackChain({
      testId: 'go',
      fallbackSelectors: ['.btn'],
    })
    // testId comes before fallbackSelectors in chain
    expect(el).not.toBeNull()
    expect(el?.getAttribute('data-testid')).toBe('go')
  })

  it('handles invalid CSS selectors without throwing', () => {
    document.body.innerHTML = '<div>safe</div>'
    const el = tryFallbackChain({
      fallbackSelectors: ['[invalid===', 'div'],
    })
    expect(el).not.toBeNull()
  })
})

describe('findElement with fallback chain', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('uses fallbackSelectors when primary selector fails', () => {
    document.body.innerHTML = '<button aria-label="Save">Save</button>'
    const el = findElement({
      css: '#missing-btn',
      fallbackSelectors: ['[aria-label="Save"]'],
    })
    expect(el).not.toBeNull()
    expect(el?.getAttribute('aria-label')).toBe('Save')
  })

  it('prefers primary selector over fallback chain', () => {
    document.body.innerHTML = '<button id="primary" aria-label="Alt">Go</button>'
    const el = findElement({
      css: '#primary',
      fallbackSelectors: ['[aria-label="Alt"]'],
    })
    expect(el?.id).toBe('primary')
  })
})

describe('interpolate', () => {
  it('replaces template variables', () => {
    expect(interpolate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!')
  })

  it('handles multiple variables', () => {
    expect(
      interpolate('{{greeting}} {{name}}', { greeting: 'Hi', name: 'Boss' })
    ).toBe('Hi Boss')
  })

  it('leaves unmatched variables as-is', () => {
    expect(interpolate('{{known}} {{unknown}}', { known: 'yes' })).toBe('yes {{unknown}}')
  })

  it('handles empty slot values', () => {
    expect(interpolate('no templates', {})).toBe('no templates')
  })
})
