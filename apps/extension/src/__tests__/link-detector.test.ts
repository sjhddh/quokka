import { describe, it, expect } from 'vitest'
import { isQuokkaLink } from '../entrypoints/content/link-detector'

describe('isQuokkaLink', () => {
  it('detects .quokka.json links', () => {
    expect(isQuokkaLink('https://example.com/my-recipe.quokka.json')).toBe(true)
    expect(isQuokkaLink('https://gist.github.com/user/abc/raw/test.quokka.json')).toBe(true)
    expect(isQuokkaLink('https://cdn.example.com/recipes/login-flow.quokka.json')).toBe(true)
  })

  it('rejects non-.quokka.json links', () => {
    expect(isQuokkaLink('https://example.com/page.html')).toBe(false)
    expect(isQuokkaLink('https://example.com/data.json')).toBe(false)
    expect(isQuokkaLink('https://example.com/recipe.quokka.txt')).toBe(false)
    expect(isQuokkaLink('https://example.com/')).toBe(false)
  })

  it('handles invalid URLs gracefully', () => {
    expect(isQuokkaLink('not-a-url')).toBe(false)
    expect(isQuokkaLink('')).toBe(false)
  })

  it('handles URLs with query strings', () => {
    expect(isQuokkaLink('https://example.com/recipe.quokka.json?v=1')).toBe(true)
  })

  it('handles URLs with hash fragments', () => {
    expect(isQuokkaLink('https://example.com/recipe.quokka.json#section')).toBe(true)
  })
})
