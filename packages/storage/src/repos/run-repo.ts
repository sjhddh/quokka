import { eq } from 'drizzle-orm'
import type { Run, RunStatus } from '@quokka/shared'
import type { QuokkaDb } from '../db.js'
import { runs } from '../schema.js'

interface RunRow {
  id: string
  recipeId: string
  status: string
  slotValuesJson: string
  currentStepIndex: number
  startedAt: string | null
  finishedAt: string | null
  error: string | null
}

function toRow(run: Run): RunRow {
  return {
    id: run.id,
    recipeId: run.recipeId,
    status: run.status,
    slotValuesJson: JSON.stringify(run.slotValues),
    currentStepIndex: run.currentStepIndex,
    startedAt: run.startedAt ?? null,
    finishedAt: run.finishedAt ?? null,
    error: run.error ?? null,
  }
}

function fromRow(row: RunRow): Run {
  return {
    id: row.id,
    recipeId: row.recipeId,
    status: row.status as RunStatus,
    slotValues: JSON.parse(row.slotValuesJson),
    currentStepIndex: row.currentStepIndex,
    startedAt: row.startedAt ?? undefined,
    finishedAt: row.finishedAt ?? undefined,
    error: row.error ?? undefined,
  }
}

export class RunRepo {
  constructor(private db: QuokkaDb) {}

  create(run: Run): Run {
    const row = toRow(run)
    this.db.insert(runs).values(row).run()
    return run
  }

  getById(id: string): Run | undefined {
    const row = this.db.select().from(runs).where(eq(runs.id, id)).get()
    return row ? fromRow(row as RunRow) : undefined
  }

  listByRecipe(recipeId: string): Run[] {
    const rows = this.db.select().from(runs).where(eq(runs.recipeId, recipeId)).all()
    return rows.map((r) => fromRow(r as RunRow))
  }

  updateStatus(
    id: string,
    status: RunStatus,
    extra?: { currentStepIndex?: number; finishedAt?: string; error?: string }
  ): Run | undefined {
    const existing = this.getById(id)
    if (!existing) return undefined

    const updates: Record<string, unknown> = { status }
    if (extra?.currentStepIndex !== undefined) updates.currentStepIndex = extra.currentStepIndex
    if (extra?.finishedAt !== undefined) updates.finishedAt = extra.finishedAt
    if (extra?.error !== undefined) updates.error = extra.error

    this.db.update(runs).set(updates).where(eq(runs.id, id)).run()
    return { ...existing, status, ...extra }
  }
}
