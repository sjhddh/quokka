import { eq } from 'drizzle-orm'
import type { Recipe } from '@quokka/shared'
import type { QuokkaDb } from '../db.js'
import { recipes } from '../schema.js'

interface RecipeRow {
  id: string
  name: string
  description: string | null
  version: string
  hostsJson: string
  stepsJson: string
  slotsJson: string
  guardsJson: string
  metaJson: string
  createdAt: string
  updatedAt: string
}

function toRow(recipe: Recipe): RecipeRow {
  const now = new Date().toISOString()
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description ?? null,
    version: recipe.version,
    hostsJson: JSON.stringify(recipe.hosts),
    stepsJson: JSON.stringify(recipe.steps),
    slotsJson: JSON.stringify(recipe.slots),
    guardsJson: JSON.stringify(recipe.guards),
    metaJson: JSON.stringify(recipe.meta),
    createdAt: now,
    updatedAt: now,
  }
}

function fromRow(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    version: row.version,
    hosts: JSON.parse(row.hostsJson),
    steps: JSON.parse(row.stepsJson),
    slots: JSON.parse(row.slotsJson),
    guards: JSON.parse(row.guardsJson),
    meta: JSON.parse(row.metaJson),
  }
}

export class RecipeRepo {
  constructor(private db: QuokkaDb) {}

  create(recipe: Recipe): Recipe {
    const row = toRow(recipe)
    this.db.insert(recipes).values(row).run()
    return recipe
  }

  getById(id: string): Recipe | undefined {
    const row = this.db.select().from(recipes).where(eq(recipes.id, id)).get()
    return row ? fromRow(row as RecipeRow) : undefined
  }

  list(): Recipe[] {
    const rows = this.db.select().from(recipes).all()
    return rows.map((r) => fromRow(r as RecipeRow))
  }

  update(id: string, partial: Partial<Recipe>): Recipe | undefined {
    const existing = this.getById(id)
    if (!existing) return undefined

    const merged = { ...existing, ...partial, id }
    const row = toRow(merged)
    row.updatedAt = new Date().toISOString()

    this.db.update(recipes).set(row).where(eq(recipes.id, id)).run()
    return merged
  }

  delete(id: string): boolean {
    const result = this.db.delete(recipes).where(eq(recipes.id, id)).run()
    return result.changes > 0
  }
}
