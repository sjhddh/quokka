import { RecipeSchema, QuokkaExportSchema } from '@quokka/shared'
import type { Recipe } from '@quokka/shared'

export class ImportValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: string[],
  ) {
    super(message)
    this.name = 'ImportValidationError'
  }
}

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
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new ImportValidationError('The file is empty.')
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportValidationError(
      "This doesn't look like a valid recipe file. The file must contain valid JSON.",
    )
  }

  // Basic structural check — must be an object or array of objects
  if (typeof data !== 'object' || data === null) {
    throw new ImportValidationError(
      "This doesn't look like a valid recipe file. Expected a JSON object or array.",
    )
  }

  // Handle array (bulk import)
  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new ImportValidationError('The file contains an empty array — no recipes to import.')
    }
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
      throw new ImportValidationError(
        'None of the recipes in this file are valid.',
        errors,
      )
    }
    return previews
  }

  return parseSingle(data)
}

function parseSingle(data: unknown, index?: number): ImportPreview {
  const prefix = index !== undefined ? `Recipe ${index + 1}: ` : ''

  if (typeof data !== 'object' || data === null) {
    throw new ImportValidationError(
      `${prefix}Expected a JSON object but got ${data === null ? 'null' : typeof data}.`,
    )
  }

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

  // Provide a helpful error message based on what's wrong
  const obj = data as Record<string, unknown>
  const hints: string[] = []
  if (!obj.id && !obj.recipe) hints.push('missing "id" field')
  if (!obj.name && !obj.recipe) hints.push('missing "name" field')
  if (!obj.steps && !obj.recipe) hints.push('missing "steps" field')
  if (obj.recipe && typeof obj.recipe !== 'object') hints.push('"recipe" field is not an object')

  const hintText = hints.length > 0 ? ` (${hints.join(', ')})` : ''
  throw new ImportValidationError(
    `${prefix}This doesn't look like a valid recipe file${hintText}.`,
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
