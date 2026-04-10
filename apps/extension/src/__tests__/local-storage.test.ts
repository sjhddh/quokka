import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Recipe } from '@quokka/shared'

// ---------- Mock chrome.storage.local ----------
const store: Record<string, unknown> = {}

const chromeStorageMock = {
  get: vi.fn((key: string) => {
    return Promise.resolve({ [key]: store[key] })
  }),
  set: vi.fn((items: Record<string, unknown>) => {
    Object.assign(store, items)
    return Promise.resolve()
  }),
  remove: vi.fn((key: string) => {
    delete store[key]
    return Promise.resolve()
  }),
}

vi.stubGlobal('chrome', {
  storage: {
    local: chromeStorageMock,
  },
})

// ---------- Mock idb-storage (the underlying store) ----------
const idbRecipes = new Map<string, Recipe>()

vi.mock('../lib/idb-storage', () => ({
  getRecipes: vi.fn(() => Promise.resolve(Array.from(idbRecipes.values()))),
  getRecipe: vi.fn((id: string) => Promise.resolve(idbRecipes.get(id))),
  saveRecipe: vi.fn((recipe: Recipe) => {
    idbRecipes.set(recipe.id, recipe)
    return Promise.resolve()
  }),
  deleteRecipe: vi.fn((id: string) => {
    idbRecipes.delete(id)
    return Promise.resolve()
  }),
}))

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
    // Clear stores between tests
    for (const key of Object.keys(store)) delete store[key]
    idbRecipes.clear()
    vi.clearAllMocks()
  })

  describe('getRecipes', () => {
    it('returns empty array when nothing stored', async () => {
      const recipes = await getRecipes()
      expect(recipes).toEqual([])
    })

    it('returns stored recipes from IndexedDB', async () => {
      const recipe = makeRecipe()
      idbRecipes.set(recipe.id, recipe)
      const recipes = await getRecipes()
      expect(recipes).toEqual([recipe])
    })
  })

  describe('getRecipe', () => {
    it('finds a recipe by id', async () => {
      const r1 = makeRecipe({ id: 'r1' })
      const r2 = makeRecipe({ id: 'r2', name: 'Second' })
      idbRecipes.set(r1.id, r1)
      idbRecipes.set(r2.id, r2)

      const found = await getRecipe('r2')
      expect(found).toEqual(r2)
    })

    it('returns undefined when not found', async () => {
      idbRecipes.set('r1', makeRecipe({ id: 'r1' }))
      const found = await getRecipe('missing')
      expect(found).toBeUndefined()
    })
  })

  describe('saveRecipe', () => {
    it('saves a recipe to IndexedDB and updates the metadata index', async () => {
      const recipe = makeRecipe({ id: 'r1' })
      await saveRecipe(recipe)

      expect(idbRecipes.has('r1')).toBe(true)
      // Check metadata index was updated
      expect(chromeStorageMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          quokka_recipe_index: expect.arrayContaining([
            expect.objectContaining({ id: 'r1', name: 'Test Recipe' }),
          ]),
        }),
      )
    })

    it('replaces an existing recipe with the same id', async () => {
      idbRecipes.set('r1', makeRecipe({ id: 'r1', name: 'Original' }))

      const updated = makeRecipe({ id: 'r1', name: 'Updated' })
      await saveRecipe(updated)

      expect(idbRecipes.get('r1')?.name).toBe('Updated')
    })
  })

  describe('deleteRecipe', () => {
    it('removes a recipe from IndexedDB and updates the metadata index', async () => {
      const r1 = makeRecipe({ id: 'r1' })
      const r2 = makeRecipe({ id: 'r2' })
      idbRecipes.set(r1.id, r1)
      idbRecipes.set(r2.id, r2)

      await deleteRecipe('r1')

      expect(idbRecipes.has('r1')).toBe(false)
      expect(idbRecipes.has('r2')).toBe(true)
    })
  })

  describe('delegation', () => {
    it('delegates to idb-storage for all operations', async () => {
      const { saveRecipe: idbSave, deleteRecipe: idbDelete } = await import('../lib/idb-storage')

      const recipe = makeRecipe({ id: 'delegate-1' })
      await saveRecipe(recipe)
      expect(idbSave).toHaveBeenCalledWith(recipe)

      await deleteRecipe('delegate-1')
      expect(idbDelete).toHaveBeenCalledWith('delegate-1')
    })
  })
})
