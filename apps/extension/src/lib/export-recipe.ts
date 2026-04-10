import type { Recipe, QuokkaExport } from '@quokka/shared'

const QUOKKA_VERSION = '0.3.0'

/**
 * Wrap a recipe in the Quokka export envelope.
 */
export function wrapRecipe(recipe: Recipe): QuokkaExport {
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
}

/**
 * Trigger a browser download of multiple recipes as a single .quokka.json file.
 */
export function downloadAllRecipes(recipes: Recipe[]): void {
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
}
