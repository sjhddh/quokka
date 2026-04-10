import { RecipeSchema, ALLOWED_STEP_TYPES } from '@quokka/shared'
import type { Recipe } from '@quokka/shared'

export interface SanitizeResult {
  valid: boolean
  recipe?: Recipe
  errors?: string[]
}

/** Protocols allowed in navigate step URLs */
const SAFE_URL_PROTOCOLS = ['http:', 'https:']

/** Dangerous patterns in CSS selectors (no actual XSS risk since we never innerHTML, but defense-in-depth) */
const DANGEROUS_SELECTOR_PATTERN = /[<>]/

/**
 * Validate a navigate URL is safe (http/https only).
 * Rejects javascript:, data:, file:, etc.
 * Template variables like {{url}} are allowed through.
 */
function validateNavigateUrl(url: string): string | null {
  // Allow template slot references
  if (url.startsWith('{{') && url.endsWith('}}')) {
    return null
  }

  try {
    const parsed = new URL(url)
    if (!SAFE_URL_PROTOCOLS.includes(parsed.protocol)) {
      return `Unsafe URL protocol "${parsed.protocol}" in navigate step. Only http: and https: are allowed.`
    }
  } catch {
    // If it's not a valid URL and not a template, flag it
    // But allow relative-looking paths that might be template-interpolated
    const lower = url.toLowerCase()
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:')) {
      return `Unsafe URL scheme in navigate step: "${url}"`
    }
  }

  return null
}

/**
 * Validate a CSS selector is safe.
 */
function validateSelector(selector: string): string | null {
  if (DANGEROUS_SELECTOR_PATTERN.test(selector)) {
    return `Potentially dangerous characters in CSS selector: "${selector}"`
  }
  return null
}

/**
 * Sanitize and validate a recipe before import or execution.
 * - Validates against RecipeSchema with Zod (strips unknown fields)
 * - Checks all step types are in the allowlist
 * - Validates URLs in navigate steps
 * - Validates CSS selectors in extract steps
 */
export function sanitizeRecipe(input: unknown): SanitizeResult {
  const errors: string[] = []

  // Step 1: Validate and strip unknown fields via Zod
  const parsed = RecipeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      ),
    }
  }

  const recipe = parsed.data

  // Step 2: Verify all step types are allowlisted (belt-and-suspenders with Zod discriminatedUnion)
  for (let i = 0; i < recipe.steps.length; i++) {
    const step = recipe.steps[i]
    if (!(ALLOWED_STEP_TYPES as readonly string[]).includes(step.type)) {
      errors.push(`Step ${i}: unknown step type "${step.type}"`)
    }
  }

  // Step 3: Validate navigate URLs
  for (let i = 0; i < recipe.steps.length; i++) {
    const step = recipe.steps[i]
    if (step.type === 'navigate') {
      const urlError = validateNavigateUrl(step.url)
      if (urlError) {
        errors.push(`Step ${i}: ${urlError}`)
      }
    }
  }

  // Step 4: Validate CSS selectors in extract steps
  for (let i = 0; i < recipe.steps.length; i++) {
    const step = recipe.steps[i]
    if (step.type === 'extract' && step.target.css) {
      const selectorError = validateSelector(step.target.css)
      if (selectorError) {
        errors.push(`Step ${i}: ${selectorError}`)
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, recipe }
}
