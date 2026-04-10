import type { Recipe } from '@quokka/shared'

const DB_NAME = 'quokka-recipes'
const DB_VERSION = 1
const STORE_NAME = 'recipes'

let dbPromise: Promise<IDBDatabase> | null = null

/**
 * Open (or reuse) the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('name', 'name', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

/**
 * Helper: wrap an IDBRequest in a Promise.
 */
function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Helper: wrap a transaction completion in a Promise.
 */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })
}

/**
 * Read all recipes from IndexedDB.
 */
export async function getRecipes(): Promise<Recipe[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  return req<Recipe[]>(store.getAll())
}

/**
 * Get a single recipe by ID.
 */
export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const result = await req<Recipe | undefined>(store.get(id))
  return result ?? undefined
}

/**
 * Save (upsert) a recipe. Uses `put` which inserts or replaces by keyPath.
 */
export async function saveRecipe(recipe: Recipe): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  store.put(recipe)
  await txDone(tx)
}

/**
 * Delete a recipe by ID.
 */
export async function deleteRecipe(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  store.delete(id)
  await txDone(tx)
}

/**
 * Get total number of recipes stored.
 */
export async function getRecipeCount(): Promise<number> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  return req<number>(store.count())
}

/**
 * Estimate total storage size of all recipes (serialized JSON bytes).
 */
export async function getStorageSize(): Promise<number> {
  const recipes = await getRecipes()
  const json = JSON.stringify(recipes)
  return new Blob([json]).size
}

/**
 * Reset the cached DB promise (useful for testing).
 */
export function _resetDB(): void {
  dbPromise = null
}
