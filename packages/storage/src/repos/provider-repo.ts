import { eq } from 'drizzle-orm'
import type { QuokkaDb } from '../db.js'
import { providers } from '../schema.js'

export interface ProviderRow {
  id: string
  name: string
  type: string
  apiKey: string | null
  baseUrl: string | null
  model: string | null
  createdAt: string
  updatedAt: string
}

export class ProviderRepo {
  constructor(private db: QuokkaDb) {}

  create(provider: Omit<ProviderRow, 'createdAt' | 'updatedAt'>): ProviderRow {
    const now = new Date().toISOString()
    const row: ProviderRow = {
      ...provider,
      createdAt: now,
      updatedAt: now,
    }
    this.db.insert(providers).values(row).run()
    return row
  }

  getById(id: string): ProviderRow | undefined {
    const row = this.db.select().from(providers).where(eq(providers.id, id)).get()
    return row ? (row as ProviderRow) : undefined
  }

  list(): ProviderRow[] {
    const rows = this.db.select().from(providers).all()
    return rows as ProviderRow[]
  }

  update(
    id: string,
    data: Partial<Omit<ProviderRow, 'id' | 'createdAt' | 'updatedAt'>>
  ): ProviderRow | undefined {
    const existing = this.getById(id)
    if (!existing) return undefined

    const updates = { ...data, updatedAt: new Date().toISOString() }
    this.db.update(providers).set(updates).where(eq(providers.id, id)).run()
    return { ...existing, ...updates }
  }

  delete(id: string): boolean {
    const result = this.db.delete(providers).where(eq(providers.id, id)).run()
    return result.changes > 0
  }
}
