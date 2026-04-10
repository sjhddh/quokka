import { describe, it, expect, beforeEach } from 'vitest'
import {
  captureFallbacks,
  buildNthChildPath,
} from '../entrypoints/content/fallback-capture'

describe('buildNthChildPath', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('builds path from element to body when no ID ancestor', () => {
    document.body.innerHTML = '<div><span><a>link</a></span></div>'
    const el = document.querySelector('a')!
    const path = buildNthChildPath(el)
    expect(path).toBe('body > div:nth-child(1) > span:nth-child(1) > a:nth-child(1)')
  })

  it('anchors path at nearest ID ancestor', () => {
    document.body.innerHTML = '<div id="root"><ul><li>one</li><li>two</li></ul></div>'
    const el = document.querySelectorAll('li')[1]!
    const path = buildNthChildPath(el)
    expect(path).toBe('#root > ul:nth-child(1) > li:nth-child(2)')
  })

  it('returns ID selector for element with own ID', () => {
    document.body.innerHTML = '<button id="submit">Go</button>'
    const el = document.querySelector('#submit')!
    const path = buildNthChildPath(el)
    expect(path).toBe('#submit')
  })

  it('handles deeply nested elements', () => {
    document.body.innerHTML = '<div><div><div><div><span>deep</span></div></div></div></div>'
    const el = document.querySelector('span')!
    const path = buildNthChildPath(el)
    expect(path).toContain('span:nth-child(1)')
    expect(path).toMatch(/^body/)
  })

  it('correctly indexes among siblings', () => {
    document.body.innerHTML = '<ul><li>a</li><li>b</li><li>c</li></ul>'
    const el = document.querySelectorAll('li')[2]!
    const path = buildNthChildPath(el)
    expect(path).toContain('li:nth-child(3)')
  })

  it('stops at nearest ID, not document root', () => {
    document.body.innerHTML = `
      <div id="outer">
        <div id="inner">
          <span>target</span>
        </div>
      </div>`
    const el = document.querySelector('span')!
    const path = buildNthChildPath(el)
    expect(path).toBe('#inner > span:nth-child(1)')
    expect(path).not.toContain('outer')
  })
})

describe('captureFallbacks', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('captures aria-label as fallback', () => {
    document.body.innerHTML = '<button aria-label="Submit form">Go</button>'
    const el = document.querySelector('button')!
    const fallbacks = captureFallbacks(el)
    expect(fallbacks).toContain('[aria-label="Submit form"]')
  })

  it('captures data-testid as fallback', () => {
    document.body.innerHTML = '<input data-testid="email-field" />'
    const el = document.querySelector('input')!
    const fallbacks = captureFallbacks(el)
    expect(fallbacks).toContain('[data-testid="email-field"]')
  })

  it('captures text content as XPath fallback', () => {
    document.body.innerHTML = '<span>Click here</span>'
    const el = document.querySelector('span')!
    const fallbacks = captureFallbacks(el)
    expect(fallbacks).toContainEqual(expect.stringContaining('contains(text(),"Click here")'))
  })

  it('skips text content longer than 60 chars', () => {
    const longText = 'A'.repeat(61)
    document.body.innerHTML = `<span>${longText}</span>`
    const el = document.querySelector('span')!
    const fallbacks = captureFallbacks(el)
    const xpathFallbacks = fallbacks.filter(f => f.includes('contains(text()'))
    expect(xpathFallbacks).toHaveLength(0)
  })

  it('captures nth-child path', () => {
    document.body.innerHTML = '<div id="root"><ul><li>item</li></ul></div>'
    const el = document.querySelector('li')!
    const fallbacks = captureFallbacks(el)
    expect(fallbacks).toContainEqual(expect.stringContaining('nth-child'))
  })

  it('captures tag + partial class match', () => {
    document.body.innerHTML = '<button class="btn btn-primary">Go</button>'
    const el = document.querySelector('button')!
    const fallbacks = captureFallbacks(el)
    expect(fallbacks).toContainEqual(expect.stringContaining('button[class*='))
  })

  it('captures role-based selector when role present', () => {
    document.body.innerHTML = '<div role="button" aria-label="Close">X</div>'
    const el = document.querySelector('[role="button"]')!
    const fallbacks = captureFallbacks(el)
    expect(fallbacks).toContainEqual(expect.stringContaining('[role="button"]'))
  })

  it('returns at least 1 fallback for any element', () => {
    document.body.innerHTML = '<div>bare</div>'
    const el = document.querySelector('div')!
    const fallbacks = captureFallbacks(el)
    expect(fallbacks.length).toBeGreaterThanOrEqual(1)
  })

  it('deduplicates selectors', () => {
    document.body.innerHTML = '<button aria-label="Go" data-testid="go-btn">Go</button>'
    const el = document.querySelector('button')!
    const fallbacks = captureFallbacks(el)
    const unique = new Set(fallbacks)
    expect(fallbacks.length).toBe(unique.size)
  })

  it('generates 3+ fallbacks for a well-attributed element', () => {
    document.body.innerHTML = `
      <div id="form">
        <button aria-label="Submit" data-testid="submit-btn" class="btn btn-primary" role="button">
          Submit
        </button>
      </div>`
    const el = document.querySelector('button')!
    const fallbacks = captureFallbacks(el)
    expect(fallbacks.length).toBeGreaterThanOrEqual(3)
  })
})
