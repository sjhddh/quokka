import { createHash } from 'node:crypto'
import type { Recipe } from '@quokka/shared'

/**
 * Compute a deterministic SHA-256 integrity hash for a recipe.
 * Excludes the `integrity` field itself to avoid circular hashing.
 */
export function computeIntegrity(recipe: Recipe): string {
  const { integrity: _ignored, ...rest } = recipe
  const canonical = JSON.stringify(rest, Object.keys(rest).sort())
  return createHash('sha256').update(canonical).digest('hex')
}

/**
 * Verify a recipe's integrity hash matches its content.
 * Returns true if the recipe has no integrity field (optional).
 */
export function verifyIntegrity(recipe: Recipe): boolean {
  if (!recipe.integrity) {
    return true
  }
  return recipe.integrity === computeIntegrity(recipe)
}
