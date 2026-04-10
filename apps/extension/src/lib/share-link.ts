import type { Recipe } from '@quokka/shared'
import { wrapRecipe } from './export-recipe.js'

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
