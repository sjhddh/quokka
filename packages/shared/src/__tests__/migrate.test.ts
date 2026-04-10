import { describe, it, expect } from 'vitest'
import { migrateRecipe } from '../migrate.js'
import { RecipeSchema } from '../schemas/recipe.js'

describe('migrateRecipe', () => {
  const v0Recipe = {
    id: 'legacy-1',
    name: 'Legacy Recipe',
    version: '0.1.0',
    hosts: ['example.com'],
    slots: [],
    guards: [],
    steps: [
      { type: 'navigate' as const, url: 'https://example.com' },
    ],
    meta: { createdFrom: 'code' as const, tags: [] },
  }

  it('migrates a v0 recipe (no schemaVersion) to v1', () => {
    const migrated = migrateRecipe(v0Recipe)
    expect(migrated.schemaVersion).toBe(1)
    expect(migrated.createdAt).toBeDefined()
    expect(migrated.updatedAt).toBeDefined()
  })

  it('produces a recipe that validates against RecipeSchema', () => {
    const migrated = migrateRecipe(v0Recipe)
    const result = RecipeSchema.safeParse(migrated)
    expect(result.success).toBe(true)
  })

  it('preserves existing fields', () => {
    const migrated = migrateRecipe(v0Recipe)
    expect(migrated.id).toBe('legacy-1')
    expect(migrated.name).toBe('Legacy Recipe')
    expect(migrated.steps).toHaveLength(1)
  })

  it('preserves existing createdAt if present', () => {
    const withTimestamp = { ...v0Recipe, createdAt: '2024-06-15T12:00:00.000Z' }
    const migrated = migrateRecipe(withTimestamp)
    expect(migrated.createdAt).toBe('2024-06-15T12:00:00.000Z')
  })

  it('no-ops for a recipe already at v1', () => {
    const v1Recipe = { ...v0Recipe, schemaVersion: 1, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }
    const migrated = migrateRecipe(v1Recipe)
    expect(migrated.schemaVersion).toBe(1)
    expect(migrated.createdAt).toBe('2025-01-01T00:00:00Z')
  })

  it('throws for non-object input', () => {
    expect(() => migrateRecipe(null)).toThrow('Invalid recipe')
    expect(() => migrateRecipe('string')).toThrow('Invalid recipe')
  })
})
