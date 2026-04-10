import type { Recipe } from '@quokka/shared'
import { wrapRecipe } from './export-recipe.js'
import { encodeRecipeToUrl } from './url-import.js'

/**
 * Copy recipe JSON to clipboard as raw JSON text.
 */
export async function copyRecipeJson(recipe: Recipe): Promise<void> {
  const wrapped = wrapRecipe(recipe)
  const json = JSON.stringify(wrapped, null, 2)
  await navigator.clipboard.writeText(json)
}

/**
 * Copy recipe as a base64-encoded data URL to clipboard.
 * This creates a compact shareable string.
 */
export async function copyRecipeAsDataUrl(recipe: Recipe): Promise<void> {
  const wrapped = wrapRecipe(recipe)
  const json = JSON.stringify(wrapped)
  const base64 = btoa(unescape(encodeURIComponent(json)))
  const dataUrl = `data:application/json;base64,${base64}`
  await navigator.clipboard.writeText(dataUrl)
}

/**
 * Copy recipe as a compact base64 string to clipboard.
 * Recipient can paste this into the import dialog.
 */
export async function copyRecipeAsBase64(recipe: Recipe): Promise<void> {
  const wrapped = wrapRecipe(recipe)
  const json = JSON.stringify(wrapped)
  const base64 = btoa(unescape(encodeURIComponent(json)))
  await navigator.clipboard.writeText(base64)
}

/**
 * Generate a shareable URL for a recipe.
 *
 * For small recipes (<2KB encoded), encodes as base64 in a URL fragment.
 * For large recipes, falls back to copying the full JSON (caller should
 * handle the null return by offering a copy-paste flow instead).
 */
export function generateShareUrl(recipe: Recipe): string | null {
  return encodeRecipeToUrl(recipe)
}

/**
 * Copy a shareable URL for a recipe to clipboard.
 * Returns true if a URL was generated, false if the recipe is too large
 * (falls back to copying JSON).
 */
export async function copyShareUrl(recipe: Recipe): Promise<boolean> {
  const url = generateShareUrl(recipe)
  if (url) {
    await navigator.clipboard.writeText(url)
    return true
  }
  // Fall back to JSON copy for large recipes
  await copyRecipeJson(recipe)
  return false
}
