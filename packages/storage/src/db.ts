import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  hostsJson TEXT NOT NULL,
  stepsJson TEXT NOT NULL,
  slotsJson TEXT NOT NULL,
  guardsJson TEXT NOT NULL,
  metaJson TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  recipeId TEXT NOT NULL,
  status TEXT NOT NULL,
  slotValuesJson TEXT NOT NULL,
  currentStepIndex INTEGER NOT NULL DEFAULT 0,
  startedAt TEXT,
  finishedAt TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS run_events (
  id TEXT PRIMARY KEY,
  runId TEXT NOT NULL,
  type TEXT NOT NULL,
  stepIndex INTEGER,
  payloadJson TEXT,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  recipeIdsJson TEXT NOT NULL
);
`

export type QuokkaDb = BetterSQLite3Database<typeof schema>

export function createDb(dbPath?: string): QuokkaDb {
  const path = dbPath ?? ':memory:'
  const sqlite = new Database(path)
  sqlite.exec(CREATE_TABLES)
  return drizzle(sqlite, { schema })
}
