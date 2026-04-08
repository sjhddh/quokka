import { eq } from 'drizzle-orm'
import type { RunEvent } from '@quokka/shared'
import type { QuokkaDb } from '../db.js'
import { runEvents } from '../schema.js'

interface EventRow {
  id: string
  runId: string
  type: string
  stepIndex: number | null
  payloadJson: string | null
  timestamp: string
}

function toRow(event: RunEvent): EventRow {
  return {
    id: event.id,
    runId: event.runId,
    type: event.type,
    stepIndex: event.stepIndex ?? null,
    payloadJson: event.payload !== undefined ? JSON.stringify(event.payload) : null,
    timestamp: event.timestamp,
  }
}

function fromRow(row: EventRow): RunEvent {
  return {
    id: row.id,
    runId: row.runId,
    type: row.type as RunEvent['type'],
    stepIndex: row.stepIndex ?? undefined,
    payload: row.payloadJson ? JSON.parse(row.payloadJson) : undefined,
    timestamp: row.timestamp,
  }
}

export class EventRepo {
  constructor(private db: QuokkaDb) {}

  create(event: RunEvent): RunEvent {
    const row = toRow(event)
    this.db.insert(runEvents).values(row).run()
    return event
  }

  listByRun(runId: string): RunEvent[] {
    const rows = this.db.select().from(runEvents).where(eq(runEvents.runId, runId)).all()
    return rows.map((r) => fromRow(r as EventRow))
  }
}
