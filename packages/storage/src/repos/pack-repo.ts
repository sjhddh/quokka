import { eq } from 'drizzle-orm'
import type { Pack } from '@quokka/shared'
import type { QuokkaDb } from '../db.js'
import { packs } from '../schema.js'

interface PackRow {
  id: string
  name: string
  description: string | null
  version: string
  recipeIdsJson: string
}

function toRow(pack: Pack): PackRow {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description ?? null,
    version: pack.version,
    recipeIdsJson: JSON.stringify(pack.recipeIds),
  }
}

function fromRow(row: PackRow): Pack {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    version: row.version,
    recipeIds: JSON.parse(row.recipeIdsJson),
  }
}

export class PackRepo {
  constructor(private db: QuokkaDb) {}

  create(pack: Pack): Pack {
    const row = toRow(pack)
    this.db.insert(packs).values(row).run()
    return pack
  }

  getById(id: string): Pack | undefined {
    const row = this.db.select().from(packs).where(eq(packs.id, id)).get()
    return row ? fromRow(row as PackRow) : undefined
  }

  list(): Pack[] {
    const rows = this.db.select().from(packs).all()
    return rows.map((r) => fromRow(r as PackRow))
  }
}
