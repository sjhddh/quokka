import { describe, it, expect } from 'vitest'
import { RecipeSchema } from '@quokka/shared'
import { DEMO_RECIPES, STARTER_SUGGESTIONS, findStarterForUrl } from '../lib/demo-recipes'

describe('demo-recipes', () => {
  describe('DEMO_RECIPES', () => {
    it('contains 3 demo recipes', () => {
      expect(DEMO_RECIPES).toHaveLength(3)
    })

    it('each recipe has a unique id', () => {
      const ids = DEMO_RECIPES.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('each recipe is marked with meta.isDemo = true', () => {
      for (const recipe of DEMO_RECIPES) {
        expect(recipe.meta.isDemo).toBe(true)
      }
    })

    it('each recipe validates against the RecipeSchema', () => {
      for (const recipe of DEMO_RECIPES) {
        const result = RecipeSchema.safeParse(recipe)
        expect(result.success, `Recipe "${recipe.name}" failed validation: ${JSON.stringify(result.error?.issues)}`).toBe(true)
      }
    })

    it('Google Search recipe has a slot for query', () => {
      const google = DEMO_RECIPES.find((r) => r.id === 'demo-google-search')
      expect(google).toBeDefined()
      expect(google!.slots).toContainEqual(
        expect.objectContaining({ key: 'query', type: 'string' })
      )
    })

    it('Check Page Title recipe has no slots and works on any host', () => {
      const title = DEMO_RECIPES.find((r) => r.id === 'demo-check-page-title')
      expect(title).toBeDefined()
      expect(title!.slots).toHaveLength(0)
      expect(title!.hosts).toHaveLength(0)
    })

    it('Fill Form recipe has name and email slots', () => {
      const form = DEMO_RECIPES.find((r) => r.id === 'demo-fill-form')
      expect(form).toBeDefined()
      const keys = form!.slots.map((s) => s.key)
      expect(keys).toContain('name')
      expect(keys).toContain('email')
    })
  })

  describe('STARTER_SUGGESTIONS', () => {
    it('contains starter suggestions', () => {
      expect(STARTER_SUGGESTIONS.length).toBeGreaterThan(0)
    })

    it('each starter recipe validates against RecipeSchema', () => {
      for (const suggestion of STARTER_SUGGESTIONS) {
        const result = RecipeSchema.safeParse(suggestion.recipe)
        expect(result.success, `Starter "${suggestion.recipe.name}" failed validation: ${JSON.stringify(result.error?.issues)}`).toBe(true)
      }
    })

    it('each starter recipe has suggestedFor in meta', () => {
      for (const suggestion of STARTER_SUGGESTIONS) {
        expect(suggestion.recipe.meta.suggestedFor).toBeTruthy()
      }
    })
  })

  describe('findStarterForUrl', () => {
    it('returns a suggestion for matching domains', () => {
      const result = findStarterForUrl('https://www.linkedin.com/in/john-doe')
      expect(result).toBeDefined()
      expect(result!.domainMatch).toBe('linkedin.com')
    })

    it('returns a suggestion for github.com', () => {
      const result = findStarterForUrl('https://github.com/user/repo')
      expect(result).toBeDefined()
      expect(result!.domainMatch).toBe('github.com')
    })

    it('returns undefined for unmatched domains', () => {
      const result = findStarterForUrl('https://example.com')
      expect(result).toBeUndefined()
    })

    it('returns undefined for invalid URLs', () => {
      const result = findStarterForUrl('not-a-url')
      expect(result).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      const result = findStarterForUrl('')
      expect(result).toBeUndefined()
    })
  })
})
