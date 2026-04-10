import type { Recipe } from './types/index.js'

type MigrationFn = (recipe: Record<string, unknown>) => Record<string, unknown>

/**
 * Registry of migrations keyed by source version.
 * Each migration upgrades from version N to N+1.
 */
const migrations: Record<number, MigrationFn> = {
  0: (r) => ({
    ...r,
    schemaVersion: 1,
    createdAt: (r as Record<string, unknown>).createdAt ?? new Date().toISOString(),
    updatedAt: (r as Record<string, unknown>).updatedAt ?? new Date().toISOString(),
  }),
}

const LATEST_SCHEMA_VERSION = 1

/**
 * Migrate a recipe from any schema version to the latest.
 * If no schemaVersion is present, assumes v0.
 */
export function migrateRecipe(recipe: unknown): Recipe {
  if (typeof recipe !== 'object' || recipe === null) {
    throw new Error('Invalid recipe: expected an object')
  }

  let current = { ...recipe } as Record<string, unknown>
  let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : 0

  while (version < LATEST_SCHEMA_VERSION) {
    const migrate = migrations[version]
    if (!migrate) {
      throw new Error(`No migration found for schema version ${version}`)
    }
    current = migrate(current)
    version = typeof current.schemaVersion === 'number' ? current.schemaVersion : version + 1
  }

  return current as unknown as Recipe
}

export { LATEST_SCHEMA_VERSION }
