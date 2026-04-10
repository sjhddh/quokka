import type { Recipe } from '@quokka/shared'

const RECIPES_KEY = 'quokka_recipes'

/**
 * Read all locally-stored recipes from chrome.storage.local.
 */
export async function getRecipes(): Promise<Recipe[]> {
  const result = await chrome.storage.local.get(RECIPES_KEY)
  const recipes = result[RECIPES_KEY]
  return Array.isArray(recipes) ? recipes : []
}

/**
 * Get a single recipe by ID from local storage.
 */
export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const recipes = await getRecipes()
  return recipes.find((r) => r.id === id)
}

/**
 * Save (upsert) a recipe to local storage. If a recipe with the same ID
 * already exists it is replaced; otherwise it is appended.
 */
export async function saveRecipe(recipe: Recipe): Promise<void> {
  const recipes = await getRecipes()
  const idx = recipes.findIndex((r) => r.id === recipe.id)
  if (idx >= 0) {
    recipes[idx] = recipe
  } else {
    recipes.push(recipe)
  }
  await chrome.storage.local.set({ [RECIPES_KEY]: recipes })
}

/**
 * Delete a recipe by ID from local storage.
 */
export async function deleteRecipe(id: string): Promise<void> {
  const recipes = await getRecipes()
  const filtered = recipes.filter((r) => r.id !== id)
  await chrome.storage.local.set({ [RECIPES_KEY]: filtered })
}
