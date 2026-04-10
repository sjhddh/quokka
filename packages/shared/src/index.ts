// Schemas
export {
  SlotSchema,
  GuardSchema,
  CheckpointSchema,
  LocatorSchema,
  StepSchema,
  ConditionSchema,
  RecipeSchema,
  QuokkaExportSchema,
  AuthorSchema,
  ALLOWED_STEP_TYPES,
} from './schemas/recipe.js'
export { RunStatusSchema, RunSchema } from './schemas/run.js'
export { RunEventTypeSchema, RunEventSchema } from './schemas/event.js'
export { PackSchema } from './schemas/pack.js'

// v2 schemas
export {
  ActionStepSchema,
  PageBoundarySchema,
  RecipeV2Schema,
  PlannedActionSchema,
  ExecutionPlanSchema,
  PlanningPhaseSchema,
  AccessNodeSchema,
  PageSnapshotSchema,
} from './schemas/recipe-v2.js'

// Types
export type {
  Slot,
  Guard,
  Checkpoint,
  Locator,
  Condition,
  Step,
  Recipe,
  RunStatus,
  Run,
  RunEventType,
  RunEvent,
  Pack,
  QuokkaExport,
  Author,
  // v2 types
  ActionStep,
  PageBoundary,
  RecipeV2Step,
  RecipeV2,
  PlannedAction,
  ExecutionPlan,
  PlanningPhase,
  AccessNode,
  PageSnapshot,
} from './types/index.js'

// Migration
export { migrateRecipe, LATEST_SCHEMA_VERSION } from './migrate.js'
export { migrateV1toV2 } from './migration/index.js'

// Events
export { RUN_EVENT_TYPES } from './events/index.js'
export type { RunEventMap, RunEventHandler } from './events/index.js'
