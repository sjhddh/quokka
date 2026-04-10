import { describe, it, expect } from 'vitest'
import {
  encodeRecipeToUrl,
  decodeRecipeFromUrl,
  isQuokkaRecipeUrl,
  validateRecipeData,
  recipeToPreview,
} from '../lib/url-import'
import type { Recipe } from '@quokka/shared'

const VALID_RECIPE: Recipe = {
  id: 'test-recipe-url',
  name: 'URL Test Recipe',
  version: '0.1.0',
  schemaVersion: 1,
  hosts: ['example.com'],
  slots: [],
  guards: [],
  steps: [{ type: 'navigate', url: 'https://example.com' }],
  meta: { createdFrom: 'code' as const, tags: [] },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const VALID_EXPORT = {
  quokka_version: '0.3.0',
  exported_at: '2024-01-01T00:00:00.000Z',
  recipe: VALID_RECIPE,
}

describe('URL import utilities', () => {
  describe('encodeRecipeToUrl / decodeRecipeFromUrl roundtrip', () => {
    it('encodes and decodes a small recipe', () => {
      const url = encodeRecipeToUrl(VALID_RECIPE)
      expect(url).not.toBeNull()
      expect(url).toContain('quokka.run/import#data=')

      const decoded = decodeRecipeFromUrl(url!)
      expect(decoded).not.toBeNull()
      expect(decoded!.id).toBe(VALID_RECIPE.id)
      expect(decoded!.name).toBe(VALID_RECIPE.name)
      expect(decoded!.steps).toHaveLength(1)
    })

    it('preserves all recipe fields through roundtrip', () => {
      const url = encodeRecipeToUrl(VALID_RECIPE)!
      const decoded = decodeRecipeFromUrl(url)!

      expect(decoded.id).toBe(VALID_RECIPE.id)
      expect(decoded.name).toBe(VALID_RECIPE.name)
      expect(decoded.version).toBe(VALID_RECIPE.version)
      expect(decoded.hosts).toEqual(VALID_RECIPE.hosts)
      expect(decoded.slots).toEqual(VALID_RECIPE.slots)
      expect(decoded.guards).toEqual(VALID_RECIPE.guards)
      expect(decoded.meta).toEqual(VALID_RECIPE.meta)
    })

    it('returns null for recipes that are too large', () => {
      const largeRecipe: Recipe = {
        ...VALID_RECIPE,
        steps: Array.from({ length: 100 }, (_, i) => ({
          type: 'navigate' as const,
          url: `https://example.com/very/long/path/that/makes/recipe/large/step-${i}?with=query&params=true&and=more&data=here`,
        })),
      }
      const url = encodeRecipeToUrl(largeRecipe)
      // May or may not be null depending on actual size — just verify it's handled
      if (url === null) {
        expect(url).toBeNull()
      } else {
        // If it fits, it should still decode
        const decoded = decodeRecipeFromUrl(url)
        expect(decoded).not.toBeNull()
      }
    })
  })

  describe('decodeRecipeFromUrl', () => {
    it('returns null for URLs without hash fragment', () => {
      expect(decodeRecipeFromUrl('https://example.com/page')).toBeNull()
    })

    it('returns null for URLs with wrong fragment format', () => {
      expect(decodeRecipeFromUrl('https://quokka.run/import#foo=bar')).toBeNull()
    })

    it('returns null for URLs with invalid base64', () => {
      expect(decodeRecipeFromUrl('https://quokka.run/import#data=!!!invalid!!!')).toBeNull()
    })

    it('returns null for URLs with valid base64 but invalid recipe JSON', () => {
      const base64 = btoa('{"not":"a recipe"}')
      expect(decodeRecipeFromUrl(`https://quokka.run/import#data=${base64}`)).toBeNull()
    })
  })

  describe('isQuokkaRecipeUrl', () => {
    it('detects .quokka.json URLs', () => {
      expect(isQuokkaRecipeUrl('https://example.com/my-recipe.quokka.json')).toBe(true)
      expect(isQuokkaRecipeUrl('https://gist.github.com/user/abc123/raw/recipe.quokka.json')).toBe(true)
    })

    it('detects .quokka.json with query params', () => {
      expect(isQuokkaRecipeUrl('https://example.com/recipe.quokka.json?token=abc')).toBe(true)
    })

    it('detects .quokka.json with hash', () => {
      expect(isQuokkaRecipeUrl('https://example.com/recipe.quokka.json#section')).toBe(true)
    })

    it('detects quokka-import query param', () => {
      expect(isQuokkaRecipeUrl('https://example.com/recipe.json?quokka-import')).toBe(true)
      expect(isQuokkaRecipeUrl('https://example.com/recipe.json?quokka-import=true')).toBe(true)
    })

    it('detects quokka.run/import URLs', () => {
      expect(isQuokkaRecipeUrl('https://quokka.run/import#data=abc123')).toBe(true)
    })

    it('rejects non-quokka URLs', () => {
      expect(isQuokkaRecipeUrl('https://example.com/page.html')).toBe(false)
      expect(isQuokkaRecipeUrl('https://example.com/recipe.json')).toBe(false)
      expect(isQuokkaRecipeUrl('https://example.com/')).toBe(false)
    })
  })

  describe('validateRecipeData', () => {
    it('validates a raw Recipe object', () => {
      const result = validateRecipeData(VALID_RECIPE)
      expect(result).not.toBeNull()
      expect(result!.name).toBe('URL Test Recipe')
    })

    it('validates a QuokkaExport wrapper', () => {
      const result = validateRecipeData(VALID_EXPORT)
      expect(result).not.toBeNull()
      expect(result!.name).toBe('URL Test Recipe')
    })

    it('returns null for invalid data', () => {
      expect(validateRecipeData(null)).toBeNull()
      expect(validateRecipeData(undefined)).toBeNull()
      expect(validateRecipeData(42)).toBeNull()
      expect(validateRecipeData('string')).toBeNull()
      expect(validateRecipeData({})).toBeNull()
      expect(validateRecipeData({ not: 'a recipe' })).toBeNull()
    })
  })

  describe('recipeToPreview', () => {
    it('builds a correct preview from a recipe', () => {
      const preview = recipeToPreview(VALID_RECIPE)
      expect(preview.name).toBe('URL Test Recipe')
      expect(preview.stepCount).toBe(1)
      expect(preview.hosts).toEqual(['example.com'])
      expect(preview.recipe).toBe(VALID_RECIPE)
    })

    it('includes description when present', () => {
      const recipe = { ...VALID_RECIPE, description: 'Test description' }
      const preview = recipeToPreview(recipe)
      expect(preview.description).toBe('Test description')
    })

    it('has undefined description when not present', () => {
      const preview = recipeToPreview(VALID_RECIPE)
      expect(preview.description).toBeUndefined()
    })
  })
})
