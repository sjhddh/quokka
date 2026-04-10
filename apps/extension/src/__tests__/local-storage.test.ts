import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Recipe } from '@quokka/shared'

// Mock chrome.storage.local
const store: Record<string, unknown> = {}

const chromeStorageMock = {
  get: vi.fn((key: string) => {
    return Promise.resolve({ [key]: store[key] })
  }),
  set: vi.fn((items: Record<string, unknown>) => {
    Object.assign(store, items)
    return Promise.resolve()
  }),
}

vi.stubGlobal('chrome', {
  storage: {
    local: chromeStorageMock,
  },
})

// Import after mocking
import { getRecipes, getRecipe, saveRecipe, deleteRecipe } from '../lib/local-storage'

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    name: 'Test Recipe',
    version: '0.1.0',
    schemaVersion: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    hosts: ['example.com'],
    slots: [],
    guards: [],
    steps: [],
    meta: { createdFrom: 'watch', tags: [] },
    ...overrides,
  } as Recipe
}

describe('local-storage', () => {
  beforeEach(() => {
    // Clear store between tests
    for (const key of Object.keys(store)) {
      delete store[key]
    }
    vi.clearAllMocks()
  })

  describe('getRecipes', () => {
    it('returns empty array when nothing stored', async () => {
      const recipes = await getRecipes()
      expect(recipes).toEqual([])
    })

    it('returns stored recipes', async () => {
      const recipe = makeRecipe()
      store['quokka_recipes'] = [recipe]
      const recipes = await getRecipes()
      expect(recipes).toEqual([recipe])
    })

    it('returns empty array if stored value is not an array', async () => {
      store['quokka_recipes'] = 'not-an-array'
      const recipes = await getRecipes()
      expect(recipes).toEqual([])
    })
  })

  describe('getRecipe', () => {
    it('finds a recipe by id', async () => {
      const r1 = makeRecipe({ id: 'r1' })
      const r2 = makeRecipe({ id: 'r2', name: 'Second' })
      store['quokka_recipes'] = [r1, r2]

      const found = await getRecipe('r2')
      expect(found).toEqual(r2)
    })

    it('returns undefined when not found', async () => {
      store['quokka_recipes'] = [makeRecipe({ id: 'r1' })]
      const found = await getRecipe('missing')
      expect(found).toBeUndefined()
    })
  })

  describe('saveRecipe', () => {
    it('appends a new recipe', async () => {
      const recipe = makeRecipe({ id: 'r1' })
      await saveRecipe(recipe)

      expect(chromeStorageMock.set).toHaveBeenCalledWith({
        quokka_recipes: [recipe],
      })
    })

    it('replaces an existing recipe with the same id', async () => {
      const original = makeRecipe({ id: 'r1', name: 'Original' })
      store['quokka_recipes'] = [original]

      const updated = makeRecipe({ id: 'r1', name: 'Updated' })
      await saveRecipe(updated)

      expect(chromeStorageMock.set).toHaveBeenCalledWith({
        quokka_recipes: [updated],
      })
    })

    it('preserves other recipes when upserting', async () => {
      const r1 = makeRecipe({ id: 'r1' })
      const r2 = makeRecipe({ id: 'r2', name: 'Second' })
      store['quokka_recipes'] = [r1, r2]

      const r1Updated = makeRecipe({ id: 'r1', name: 'Updated' })
      await saveRecipe(r1Updated)

      expect(chromeStorageMock.set).toHaveBeenCalledWith({
        quokka_recipes: [r1Updated, r2],
      })
    })
  })

  describe('deleteRecipe', () => {
    it('removes a recipe by id', async () => {
      const r1 = makeRecipe({ id: 'r1' })
      const r2 = makeRecipe({ id: 'r2' })
      store['quokka_recipes'] = [r1, r2]

      await deleteRecipe('r1')

      expect(chromeStorageMock.set).toHaveBeenCalledWith({
        quokka_recipes: [r2],
      })
    })

    it('does nothing if recipe not found', async () => {
      const r1 = makeRecipe({ id: 'r1' })
      store['quokka_recipes'] = [r1]

      await deleteRecipe('missing')

      expect(chromeStorageMock.set).toHaveBeenCalledWith({
        quokka_recipes: [r1],
      })
    })
  })
})
