import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Recipe } from '@quokka/shared'

// ---------- fake-indexeddb shim ----------
// Minimal in-memory IndexedDB mock for testing.

class FakeIDBIndex {
  keyPath: string
  constructor(keyPath: string) {
    this.keyPath = keyPath
  }
}

class FakeIDBObjectStore {
  keyPath: string
  private data: Map<string, unknown>
  private _indexes: Map<string, FakeIDBIndex> = new Map()
  autoIncrement = false

  constructor(keyPath: string) {
    this.keyPath = keyPath
    this.data = new Map()
  }

  createIndex(name: string, keyPath: string, _options?: { unique?: boolean }): FakeIDBIndex {
    const idx = new FakeIDBIndex(keyPath)
    this._indexes.set(name, idx)
    return idx
  }

  put(value: Record<string, unknown>): FakeIDBRequest<IDBValidKey> {
    const key = value[this.keyPath as string] as string
    this.data.set(key, structuredClone(value))
    return fakeReq(key)
  }

  get(key: string): FakeIDBRequest<unknown> {
    return fakeReq(this.data.has(key) ? structuredClone(this.data.get(key)) : undefined)
  }

  getAll(): FakeIDBRequest<unknown[]> {
    return fakeReq(Array.from(this.data.values()).map((v) => structuredClone(v)))
  }

  delete(key: string): FakeIDBRequest<undefined> {
    this.data.delete(key)
    return fakeReq(undefined)
  }

  count(): FakeIDBRequest<number> {
    return fakeReq(this.data.size)
  }
}

interface FakeIDBRequest<T> {
  result: T
  error: DOMException | null
  onsuccess: (() => void) | null
  onerror: (() => void) | null
}

function fakeReq<T>(value: T): FakeIDBRequest<T> {
  const req: FakeIDBRequest<T> = { result: value, error: null, onsuccess: null, onerror: null }
  queueMicrotask(() => req.onsuccess?.())
  return req
}

class FakeIDBTransaction {
  private stores: Map<string, FakeIDBObjectStore>
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  error: DOMException | null = null

  constructor(stores: Map<string, FakeIDBObjectStore>) {
    this.stores = stores
    queueMicrotask(() => this.oncomplete?.())
  }

  objectStore(name: string): FakeIDBObjectStore {
    const store = this.stores.get(name)
    if (!store) throw new Error(`No store: ${name}`)
    return store
  }
}

class FakeIDBDatabase {
  objectStoreNames: { contains: (name: string) => boolean }
  private stores = new Map<string, FakeIDBObjectStore>()

  constructor() {
    this.objectStoreNames = {
      contains: (name: string) => this.stores.has(name),
    }
  }

  createObjectStore(name: string, options: { keyPath: string }): FakeIDBObjectStore {
    const store = new FakeIDBObjectStore(options.keyPath)
    this.stores.set(name, store)
    return store
  }

  transaction(storeNames: string | string[], _mode?: string): FakeIDBTransaction {
    return new FakeIDBTransaction(this.stores)
  }
}

let currentDB: FakeIDBDatabase | null = null

const fakeIndexedDB = {
  open(name: string, _version?: number) {
    const db = new FakeIDBDatabase()
    currentDB = db

    const request = {
      result: db,
      error: null as DOMException | null,
      onupgradeneeded: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    }

    queueMicrotask(() => {
      request.onupgradeneeded?.()
      queueMicrotask(() => request.onsuccess?.())
    })

    return request
  },
}

vi.stubGlobal('indexedDB', fakeIndexedDB)

// Import after mocking
import {
  getRecipes,
  getRecipe,
  saveRecipe,
  deleteRecipe,
  getRecipeCount,
  getStorageSize,
  _resetDB,
} from '../lib/idb-storage'

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

describe('idb-storage', () => {
  beforeEach(() => {
    _resetDB()
    currentDB = null
  })

  describe('getRecipes', () => {
    it('returns empty array when nothing stored', async () => {
      const recipes = await getRecipes()
      expect(recipes).toEqual([])
    })

    it('returns saved recipes', async () => {
      const recipe = makeRecipe()
      await saveRecipe(recipe)
      const recipes = await getRecipes()
      expect(recipes).toHaveLength(1)
      expect(recipes[0].id).toBe('r1')
    })
  })

  describe('getRecipe', () => {
    it('finds a recipe by id', async () => {
      await saveRecipe(makeRecipe({ id: 'r1' }))
      await saveRecipe(makeRecipe({ id: 'r2', name: 'Second' }))

      const found = await getRecipe('r2')
      expect(found?.name).toBe('Second')
    })

    it('returns undefined when not found', async () => {
      await saveRecipe(makeRecipe({ id: 'r1' }))
      const found = await getRecipe('missing')
      expect(found).toBeUndefined()
    })
  })

  describe('saveRecipe', () => {
    it('inserts a new recipe', async () => {
      await saveRecipe(makeRecipe({ id: 'r1' }))
      const count = await getRecipeCount()
      expect(count).toBe(1)
    })

    it('replaces an existing recipe with the same id', async () => {
      await saveRecipe(makeRecipe({ id: 'r1', name: 'Original' }))
      await saveRecipe(makeRecipe({ id: 'r1', name: 'Updated' }))

      const recipes = await getRecipes()
      expect(recipes).toHaveLength(1)
      expect(recipes[0].name).toBe('Updated')
    })
  })

  describe('deleteRecipe', () => {
    it('removes a recipe by id', async () => {
      await saveRecipe(makeRecipe({ id: 'r1' }))
      await saveRecipe(makeRecipe({ id: 'r2' }))
      await deleteRecipe('r1')

      const recipes = await getRecipes()
      expect(recipes).toHaveLength(1)
      expect(recipes[0].id).toBe('r2')
    })

    it('does nothing if recipe not found', async () => {
      await saveRecipe(makeRecipe({ id: 'r1' }))
      await deleteRecipe('missing')

      const count = await getRecipeCount()
      expect(count).toBe(1)
    })
  })

  describe('getRecipeCount', () => {
    it('returns 0 when empty', async () => {
      expect(await getRecipeCount()).toBe(0)
    })

    it('returns correct count', async () => {
      await saveRecipe(makeRecipe({ id: 'r1' }))
      await saveRecipe(makeRecipe({ id: 'r2' }))
      expect(await getRecipeCount()).toBe(2)
    })
  })

  describe('getStorageSize', () => {
    it('returns size in bytes', async () => {
      await saveRecipe(makeRecipe({ id: 'r1' }))
      const size = await getStorageSize()
      expect(size).toBeGreaterThan(0)
    })

    it('returns 2 for empty store (empty JSON array)', async () => {
      const size = await getStorageSize()
      // JSON.stringify([]) = "[]" = 2 bytes
      expect(size).toBe(2)
    })
  })
})
