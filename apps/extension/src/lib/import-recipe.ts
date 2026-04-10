import { RecipeSchema, QuokkaExportSchema } from '@quokka/shared'
import type { Recipe } from '@quokka/shared'

export interface ImportPreview {
  name: string
  description?: string
  stepCount: number
  hosts: string[]
  recipe: Recipe
}

/**
 * Parse and validate a recipe from raw JSON text.
 * Accepts both the QuokkaExport wrapper format and raw Recipe JSON.
 * Returns a preview for the user to confirm before saving.
 */
export function parseRecipeFile(text: string): ImportPreview | ImportPreview[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('File is not valid JSON')
  }

  // Handle array (bulk import)
  if (Array.isArray(data)) {
    const previews: ImportPreview[] = []
    const errors: string[] = []
    for (let i = 0; i < data.length; i++) {
      try {
        previews.push(parseSingle(data[i], i))
      } catch (err) {
        errors.push(`Recipe ${i + 1}: ${err instanceof Error ? err.message : 'Invalid'}`)
      }
    }
    if (previews.length === 0) {
      throw new Error(`All recipes failed validation:\n${errors.join('\n')}`)
    }
    return previews
  }

  return parseSingle(data)
}

function parseSingle(data: unknown, index?: number): ImportPreview {
  const prefix = index !== undefined ? `Recipe ${index + 1}: ` : ''

  // Try QuokkaExport wrapper first
  const wrapperResult = QuokkaExportSchema.safeParse(data)
  if (wrapperResult.success) {
    const recipe = wrapperResult.data.recipe
    return {
      name: recipe.name,
      description: recipe.description,
      stepCount: recipe.steps.length,
      hosts: recipe.hosts,
      recipe,
    }
  }

  // Fall back to raw Recipe
  const recipeResult = RecipeSchema.safeParse(data)
  if (recipeResult.success) {
    const recipe = recipeResult.data
    return {
      name: recipe.name,
      description: recipe.description,
      stepCount: recipe.steps.length,
      hosts: recipe.hosts,
      recipe,
    }
  }

  throw new Error(
    `${prefix}Invalid recipe file. Must be a valid Quokka recipe or export file.`,
  )
}

/**
 * Open a file picker and read the selected file's text content.
 * Returns null if the user cancels.
 */
export function pickRecipeFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.quokka.json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      resolve(await file.text())
    }
    // If user cancels, the onchange won't fire — use focus event as fallback
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!input.files?.length) resolve(null)
        }, 500)
      },
      { once: true },
    )
    input.click()
  })
}
