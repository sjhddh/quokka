import { describe, it, expect } from 'vitest'
import { sanitizeRecipe } from '../verifier/sanitize-recipe.js'

const validRecipe = {
  id: 'test-1',
  name: 'Test Recipe',
  version: '0.1.0',
  schemaVersion: 1 as const,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  hosts: ['example.com'],
  slots: [],
  guards: [],
  steps: [
    { type: 'navigate' as const, url: 'https://example.com' },
    { type: 'click' as const, target: { css: '#btn' } },
    { type: 'extract' as const, target: { css: '.data' }, as: 'result' },
  ],
  meta: { createdFrom: 'code' as const, tags: ['test'] },
}

describe('sanitizeRecipe', () => {
  it('accepts a valid recipe', () => {
    const result = sanitizeRecipe(validRecipe)
    expect(result.valid).toBe(true)
    expect(result.recipe).toBeDefined()
    expect(result.errors).toBeUndefined()
  })

  it('strips unknown fields', () => {
    const withExtra = { ...validRecipe, malicious: 'payload', __proto__hack: true }
    const result = sanitizeRecipe(withExtra)
    expect(result.valid).toBe(true)
    expect(result.recipe).toBeDefined()
    expect((result.recipe as Record<string, unknown>).malicious).toBeUndefined()
  })

  it('rejects recipe missing required fields', () => {
    const result = sanitizeRecipe({ id: 'bad' })
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)
  })

  it('rejects non-object input', () => {
    const result = sanitizeRecipe('not an object')
    expect(result.valid).toBe(false)
  })

  describe('navigate URL validation', () => {
    it('accepts https URLs', () => {
      const result = sanitizeRecipe(validRecipe)
      expect(result.valid).toBe(true)
    })

    it('accepts http URLs', () => {
      const recipe = {
        ...validRecipe,
        steps: [{ type: 'navigate' as const, url: 'http://example.com' }],
      }
      const result = sanitizeRecipe(recipe)
      expect(result.valid).toBe(true)
    })

    it('accepts template slot URLs', () => {
      const recipe = {
        ...validRecipe,
        steps: [{ type: 'navigate' as const, url: '{{url}}' }],
      }
      const result = sanitizeRecipe(recipe)
      expect(result.valid).toBe(true)
    })

    it('rejects javascript: URLs', () => {
      const recipe = {
        ...validRecipe,
        steps: [{ type: 'navigate' as const, url: 'javascript:alert(1)' }],
      }
      const result = sanitizeRecipe(recipe)
      expect(result.valid).toBe(false)
      expect(result.errors![0]).toContain('javascript:')
    })

    it('rejects data: URLs', () => {
      const recipe = {
        ...validRecipe,
        steps: [{ type: 'navigate' as const, url: 'data:text/html,<script>alert(1)</script>' }],
      }
      const result = sanitizeRecipe(recipe)
      expect(result.valid).toBe(false)
      expect(result.errors![0]).toContain('data:')
    })

    it('rejects file: URLs', () => {
      const recipe = {
        ...validRecipe,
        steps: [{ type: 'navigate' as const, url: 'file:///etc/passwd' }],
      }
      const result = sanitizeRecipe(recipe)
      expect(result.valid).toBe(false)
      expect(result.errors![0]).toContain('Unsafe URL')
    })
  })

  describe('CSS selector validation', () => {
    it('accepts normal selectors', () => {
      const result = sanitizeRecipe(validRecipe)
      expect(result.valid).toBe(true)
    })

    it('rejects selectors with angle brackets', () => {
      const recipe = {
        ...validRecipe,
        steps: [
          { type: 'extract' as const, target: { css: '<script>alert(1)</script>' }, as: 'x' },
        ],
      }
      const result = sanitizeRecipe(recipe)
      expect(result.valid).toBe(false)
      expect(result.errors![0]).toContain('dangerous characters')
    })
  })

  describe('new step types', () => {
    it('accepts scroll steps', () => {
      const recipe = {
        ...validRecipe,
        steps: [{ type: 'scroll' as const, target: { css: '#content' } }],
      }
      const result = sanitizeRecipe(recipe)
      expect(result.valid).toBe(true)
    })

    it('accepts select steps', () => {
      const recipe = {
        ...validRecipe,
        steps: [{ type: 'select' as const, target: { css: 'select#color' }, value: 'red' }],
      }
      const result = sanitizeRecipe(recipe)
      expect(result.valid).toBe(true)
    })

    it('accepts hover steps', () => {
      const recipe = {
        ...validRecipe,
        steps: [{ type: 'hover' as const, target: { css: '.menu' } }],
      }
      const result = sanitizeRecipe(recipe)
      expect(result.valid).toBe(true)
    })
  })
})
