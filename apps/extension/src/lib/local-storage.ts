import type { Recipe } from '@quokka/shared'
import * as idb from './idb-storage'

const RECIPES_KEY = 'quokka_recipes'
const RECIPE_INDEX_KEY = 'quokka_recipe_index'
const MIGRATION_KEY = 'quokka_idb_migrated'

interface RecipeIndexEntry {
  id: string
  name: string
  hosts: string[]
  createdAt: string
}

/**
 * Migrate recipes from chrome.storage.local to IndexedDB on first load.
 * Runs once — sets a flag so subsequent loads skip migration.
 */
async function migrateIfNeeded(): Promise<void> {
  const { [MIGRATION_KEY]: migrated } = await chrome.storage.local.get(MIGRATION_KEY)
  if (migrated) return

  // Read legacy recipes from chrome.storage.local
  const { [RECIPES_KEY]: legacyRecipes } = await chrome.storage.local.get(RECIPES_KEY)
  if (Array.isArray(legacyRecipes) && legacyRecipes.length > 0) {
    // Copy each recipe to IndexedDB
    for (const recipe of legacyRecipes as Recipe[]) {
      await idb.saveRecipe(recipe)
    }
    // Build metadata index
    const index: RecipeIndexEntry[] = (legacyRecipes as Recipe[]).map((r) => ({
      id: r.id,
      name: r.name,
      hosts: r.hosts,
      createdAt: r.createdAt,
    }))
    await chrome.storage.local.set({ [RECIPE_INDEX_KEY]: index })
    // Clear full recipe data from chrome.storage.local
    await chrome.storage.local.remove(RECIPES_KEY)
  }

  await chrome.storage.local.set({ [MIGRATION_KEY]: true })
}

// Lazy migration: starts on first access, not at module load
let migrationPromise: Promise<void> | null = null

function ensureMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateIfNeeded()
  }
  return migrationPromise
}

/**
 * Update the metadata index in chrome.storage.local after a write.
 */
async function updateIndex(): Promise<void> {
  const recipes = await idb.getRecipes()
  const index: RecipeIndexEntry[] = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    hosts: r.hosts,
    createdAt: r.createdAt,
  }))
  await chrome.storage.local.set({ [RECIPE_INDEX_KEY]: index })
}

/**
 * Read all locally-stored recipes (from IndexedDB).
 */
export async function getRecipes(): Promise<Recipe[]> {
  await ensureMigrated()
  return idb.getRecipes()
}

/**
 * Get a single recipe by ID.
 */
export async function getRecipe(id: string): Promise<Recipe | undefined> {
  await ensureMigrated()
  return idb.getRecipe(id)
}

/**
 * Save (upsert) a recipe. Writes to IndexedDB and updates the metadata index.
 */
export async function saveRecipe(recipe: Recipe): Promise<void> {
  await ensureMigrated()
  await idb.saveRecipe(recipe)
  await updateIndex()
}

/**
 * Delete a recipe by ID. Removes from IndexedDB and updates the metadata index.
 */
export async function deleteRecipe(id: string): Promise<void> {
  await ensureMigrated()
  await idb.deleteRecipe(id)
  await updateIndex()
}
