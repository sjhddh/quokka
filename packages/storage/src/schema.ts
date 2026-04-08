import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull(),
  hostsJson: text('hostsJson').notNull(),
  stepsJson: text('stepsJson').notNull(),
  slotsJson: text('slotsJson').notNull(),
  guardsJson: text('guardsJson').notNull(),
  metaJson: text('metaJson').notNull(),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
})

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  recipeId: text('recipeId').notNull(),
  status: text('status').notNull(),
  slotValuesJson: text('slotValuesJson').notNull(),
  currentStepIndex: integer('currentStepIndex').notNull().default(0),
  startedAt: text('startedAt'),
  finishedAt: text('finishedAt'),
  error: text('error'),
})

export const runEvents = sqliteTable('run_events', {
  id: text('id').primaryKey(),
  runId: text('runId').notNull(),
  type: text('type').notNull(),
  stepIndex: integer('stepIndex'),
  payloadJson: text('payloadJson'),
  timestamp: text('timestamp').notNull(),
})

export const packs = sqliteTable('packs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull(),
  recipeIdsJson: text('recipeIdsJson').notNull(),
})

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  apiKey: text('apiKey'),
  baseUrl: text('baseUrl'),
  model: text('model'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
})
