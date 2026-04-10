import type { Recipe, QuokkaExport } from '@quokka/shared'

const QUOKKA_VERSION = '0.3.0'

export class ExportError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'ExportError'
  }
}

/**
 * Wrap a recipe in the Quokka export envelope.
 */
export function wrapRecipe(recipe: Recipe): QuokkaExport {
  if (!recipe || !recipe.id || !recipe.name) {
    throw new ExportError('Cannot export an invalid or incomplete recipe')
  }
  return {
    quokka_version: QUOKKA_VERSION,
    exported_at: new Date().toISOString(),
    recipe,
  }
}

/**
 * Trigger a browser download of a recipe as a .quokka.json file.
 */
export function downloadRecipe(recipe: Recipe): void {
  try {
    const wrapped = wrapRecipe(recipe)
    const json = JSON.stringify(wrapped, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeName = recipe.name.replace(/[^a-zA-Z0-9_-]/g, '_')
    a.href = url
    a.download = `${safeName}.quokka.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    if (err instanceof ExportError) throw err
    throw new ExportError(
      'Failed to export recipe. The recipe data may be corrupted.',
      err,
    )
  }
}

/**
 * Trigger a browser download of multiple recipes as a single .quokka.json file.
 */
export function downloadAllRecipes(recipes: Recipe[]): void {
  if (!Array.isArray(recipes) || recipes.length === 0) {
    throw new ExportError('No recipes to export')
  }
  try {
    const wrapped = recipes.map((recipe) => wrapRecipe(recipe))
    const json = JSON.stringify(wrapped, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'recipes-all.quokka.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    if (err instanceof ExportError) throw err
    throw new ExportError(
      'Failed to export recipes. Some recipe data may be corrupted.',
      err,
    )
  }
}
