import { describe, it, expect } from 'vitest'
import { parseRecipeFile, ImportValidationError } from '../lib/import-recipe'

const VALID_RECIPE = {
  id: 'test-recipe-1',
  name: 'Test Recipe',
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

describe('parseRecipeFile', () => {
  describe('valid inputs', () => {
    it('parses a valid raw recipe JSON', () => {
      const result = parseRecipeFile(JSON.stringify(VALID_RECIPE))
      expect(Array.isArray(result) ? result[0] : result).toMatchObject({
        name: 'Test Recipe',
        stepCount: 1,
        hosts: ['example.com'],
      })
    })

    it('parses a valid QuokkaExport wrapper', () => {
      const result = parseRecipeFile(JSON.stringify(VALID_EXPORT))
      expect(Array.isArray(result) ? result[0] : result).toMatchObject({
        name: 'Test Recipe',
        stepCount: 1,
      })
    })

    it('parses a bulk array of recipes', () => {
      const bulk = [VALID_EXPORT, VALID_EXPORT]
      const result = parseRecipeFile(JSON.stringify(bulk))
      expect(Array.isArray(result)).toBe(true)
      expect((result as unknown[]).length).toBe(2)
    })

    it('returns preview with description when present', () => {
      const recipe = { ...VALID_RECIPE, description: 'A test recipe' }
      const result = parseRecipeFile(JSON.stringify(recipe))
      const preview = Array.isArray(result) ? result[0] : result
      expect(preview.description).toBe('A test recipe')
    })
  })

  describe('malformed JSON', () => {
    it('rejects empty string', () => {
      expect(() => parseRecipeFile('')).toThrow(ImportValidationError)
      expect(() => parseRecipeFile('')).toThrow('empty')
    })

    it('rejects whitespace-only string', () => {
      expect(() => parseRecipeFile('   \n\t  ')).toThrow(ImportValidationError)
    })

    it('rejects invalid JSON syntax', () => {
      expect(() => parseRecipeFile('{not json')).toThrow(ImportValidationError)
      expect(() => parseRecipeFile('{not json')).toThrow("doesn't look like a valid recipe")
    })

    it('rejects JSON primitive (string)', () => {
      expect(() => parseRecipeFile('"just a string"')).toThrow(ImportValidationError)
      expect(() => parseRecipeFile('"just a string"')).toThrow('Expected a JSON object or array')
    })

    it('rejects JSON primitive (number)', () => {
      expect(() => parseRecipeFile('42')).toThrow(ImportValidationError)
    })

    it('rejects JSON null', () => {
      expect(() => parseRecipeFile('null')).toThrow(ImportValidationError)
    })

    it('rejects JSON boolean', () => {
      expect(() => parseRecipeFile('true')).toThrow(ImportValidationError)
    })
  })

  describe('invalid recipe structure', () => {
    it('rejects an empty object', () => {
      expect(() => parseRecipeFile('{}')).toThrow(ImportValidationError)
      expect(() => parseRecipeFile('{}')).toThrow("doesn't look like a valid recipe")
    })

    it('provides hints about missing fields', () => {
      try {
        parseRecipeFile('{}')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ImportValidationError)
        expect((err as Error).message).toContain('missing "id"')
        expect((err as Error).message).toContain('missing "name"')
        expect((err as Error).message).toContain('missing "steps"')
      }
    })

    it('rejects recipe with missing required fields', () => {
      const partial = { id: 'x', name: 'Test' }
      expect(() => parseRecipeFile(JSON.stringify(partial))).toThrow(ImportValidationError)
    })

    it('rejects recipe with invalid step types', () => {
      const badSteps = {
        ...VALID_RECIPE,
        steps: [{ type: 'destroy', target: { css: '#btn' } }],
      }
      expect(() => parseRecipeFile(JSON.stringify(badSteps))).toThrow(ImportValidationError)
    })

    it('rejects empty array', () => {
      expect(() => parseRecipeFile('[]')).toThrow(ImportValidationError)
      expect(() => parseRecipeFile('[]')).toThrow('empty array')
    })

    it('rejects array of non-objects', () => {
      expect(() => parseRecipeFile('[1, 2, 3]')).toThrow(ImportValidationError)
      expect(() => parseRecipeFile('[1, 2, 3]')).toThrow('None of the recipes')
    })
  })

  describe('bulk import with partial failures', () => {
    it('accepts valid recipes and skips invalid ones', () => {
      const bulk = [VALID_EXPORT, { not: 'a recipe' }, VALID_EXPORT]
      const result = parseRecipeFile(JSON.stringify(bulk))
      expect(Array.isArray(result)).toBe(true)
      expect((result as unknown[]).length).toBe(2)
    })

    it('rejects when all recipes in array are invalid', () => {
      const bulk = [{ bad: 1 }, { also: 'bad' }]
      expect(() => parseRecipeFile(JSON.stringify(bulk))).toThrow(ImportValidationError)
      expect(() => parseRecipeFile(JSON.stringify(bulk))).toThrow('None of the recipes')
    })
  })

  describe('ImportValidationError', () => {
    it('has name set to ImportValidationError', () => {
      try {
        parseRecipeFile('not json')
      } catch (err) {
        expect(err).toBeInstanceOf(ImportValidationError)
        expect((err as ImportValidationError).name).toBe('ImportValidationError')
      }
    })

    it('includes details array on bulk failures', () => {
      try {
        parseRecipeFile(JSON.stringify([{ bad: 1 }, { also: 'bad' }]))
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ImportValidationError)
        const ve = err as ImportValidationError
        expect(ve.details).toBeDefined()
        expect(ve.details!.length).toBe(2)
      }
    })
  })

  describe('paste import (same parseRecipeFile, simulating pasted text)', () => {
    it('parses pasted raw recipe JSON', () => {
      const pasted = JSON.stringify(VALID_RECIPE)
      const result = parseRecipeFile(pasted)
      const preview = Array.isArray(result) ? result[0] : result
      expect(preview.name).toBe('Test Recipe')
      expect(preview.stepCount).toBe(1)
    })

    it('parses pasted QuokkaExport wrapper', () => {
      const pasted = JSON.stringify(VALID_EXPORT)
      const result = parseRecipeFile(pasted)
      const preview = Array.isArray(result) ? result[0] : result
      expect(preview.name).toBe('Test Recipe')
    })

    it('auto-detects QuokkaExport vs raw recipe', () => {
      // Raw recipe
      const rawResult = parseRecipeFile(JSON.stringify(VALID_RECIPE))
      const rawPreview = Array.isArray(rawResult) ? rawResult[0] : rawResult
      expect(rawPreview.recipe.id).toBe('test-recipe-1')

      // Wrapped export
      const wrapResult = parseRecipeFile(JSON.stringify(VALID_EXPORT))
      const wrapPreview = Array.isArray(wrapResult) ? wrapResult[0] : wrapResult
      expect(wrapPreview.recipe.id).toBe('test-recipe-1')
    })

    it('rejects invalid pasted JSON with clear message', () => {
      expect(() => parseRecipeFile('{invalid json}')).toThrow(ImportValidationError)
      expect(() => parseRecipeFile('{invalid json}')).toThrow("doesn't look like a valid recipe")
    })

    it('rejects non-recipe pasted JSON', () => {
      expect(() => parseRecipeFile('{"foo": "bar"}')).toThrow(ImportValidationError)
    })

    it('handles pasted recipe with enriched meta fields', () => {
      const enriched = {
        ...VALID_RECIPE,
        meta: {
          ...VALID_RECIPE.meta,
          author: { name: 'Alice', url: 'https://alice.dev' },
          runCount: 42,
          description: 'An enriched recipe',
        },
      }
      const result = parseRecipeFile(JSON.stringify(enriched))
      const preview = Array.isArray(result) ? result[0] : result
      expect(preview.recipe.meta.author).toEqual({ name: 'Alice', url: 'https://alice.dev' })
      expect(preview.recipe.meta.runCount).toBe(42)
      expect(preview.recipe.meta.description).toBe('An enriched recipe')
    })
  })
})
