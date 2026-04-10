import { RecipeSchema, QuokkaExportSchema } from '@quokka/shared'
import type { Recipe } from '@quokka/shared'
import { ImportValidationError, type ImportPreview } from './import-recipe.js'

/** Base URL for encoded recipe sharing */
const SHARE_BASE_URL = 'https://quokka.run/import'

/** Max recipe JSON size (bytes) for URL-fragment encoding */
const MAX_FRAGMENT_SIZE = 2048

/**
 * Encode a recipe as a shareable URL with base64 data in the fragment.
 * Only works for recipes whose JSON is under 2KB.
 * Returns null if the recipe is too large for fragment encoding.
 */
export function encodeRecipeToUrl(recipe: Recipe): string | null {
  const json = JSON.stringify(recipe)
  const encoded = btoa(unescape(encodeURIComponent(json)))
  if (encoded.length > MAX_FRAGMENT_SIZE) {
    return null
  }
  return `${SHARE_BASE_URL}#data=${encoded}`
}

/**
 * Decode a recipe from a URL that has a base64 data fragment.
 * Returns null if the URL doesn't contain valid recipe data.
 */
export function decodeRecipeFromUrl(url: string): Recipe | null {
  try {
    const hashIndex = url.indexOf('#')
    if (hashIndex === -1) return null

    const fragment = url.slice(hashIndex + 1)
    const params = new URLSearchParams(fragment)
    const data = params.get('data')
    if (!data) return null

    const json = decodeURIComponent(escape(atob(data)))
    const parsed = JSON.parse(json)
    return validateRecipeData(parsed)
  } catch {
    return null
  }
}

/**
 * Fetch a .quokka.json recipe from any URL.
 * Validates the response against the recipe schema.
 */
export async function fetchRecipeFromUrl(url: string): Promise<Recipe> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new ImportValidationError(
      'Could not fetch the recipe. Check the URL and your internet connection.',
    )
  }

  if (!response.ok) {
    throw new ImportValidationError(
      `Failed to fetch recipe: HTTP ${response.status} ${response.statusText}`,
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json') && !contentType.includes('text')) {
    throw new ImportValidationError(
      'The URL does not point to a JSON file.',
    )
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new ImportValidationError(
      'The URL returned invalid JSON.',
    )
  }

  const recipe = validateRecipeData(data)
  if (!recipe) {
    throw new ImportValidationError(
      'The fetched data is not a valid Quokka recipe.',
    )
  }
  return recipe
}

/**
 * Validate unknown data as a Recipe.
 * Accepts both raw Recipe and QuokkaExport wrapper formats.
 */
export function validateRecipeData(data: unknown): Recipe | null {
  if (typeof data !== 'object' || data === null) return null

  // Try QuokkaExport wrapper first
  const wrapperResult = QuokkaExportSchema.safeParse(data)
  if (wrapperResult.success) {
    return wrapperResult.data.recipe
  }

  // Try raw Recipe
  const recipeResult = RecipeSchema.safeParse(data)
  if (recipeResult.success) {
    return recipeResult.data
  }

  return null
}

/**
 * Check if a URL looks like a Quokka recipe URL.
 */
export function isQuokkaRecipeUrl(url: string): boolean {
  // .quokka.json file
  if (url.match(/\.quokka\.json(\?|#|$)/i)) return true

  // URL with quokka-import query param
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.has('quokka-import')) return true
  } catch {
    // not a valid URL
  }

  // quokka.run/import URL with data fragment
  if (url.includes('quokka.run/import#data=')) return true

  return false
}

/**
 * Build an ImportPreview from a validated Recipe.
 */
export function recipeToPreview(recipe: Recipe): ImportPreview {
  return {
    name: recipe.name,
    description: recipe.description,
    stepCount: recipe.steps.length,
    hosts: recipe.hosts,
    recipe,
  }
}
