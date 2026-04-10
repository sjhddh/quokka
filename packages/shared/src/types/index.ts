import { z } from 'zod'
import {
  SlotSchema,
  GuardSchema,
  CheckpointSchema,
  LocatorSchema,
  StepSchema,
  ConditionSchema,
  RecipeSchema,
  QuokkaExportSchema,
  AuthorSchema,
} from '../schemas/recipe.js'
import { RunStatusSchema, RunSchema } from '../schemas/run.js'
import { RunEventTypeSchema, RunEventSchema } from '../schemas/event.js'
import { PackSchema } from '../schemas/pack.js'
import {
  ActionStepSchema,
  PageBoundarySchema,
  RecipeV2Schema,
  PlannedActionSchema,
  ExecutionPlanSchema,
  PlanningPhaseSchema,
  AccessNodeSchema,
  PageSnapshotSchema,
} from '../schemas/recipe-v2.js'

export type Slot = z.infer<typeof SlotSchema>
export type Guard = z.infer<typeof GuardSchema>
export type Checkpoint = z.infer<typeof CheckpointSchema>
export type Locator = z.infer<typeof LocatorSchema>
export type Condition = z.infer<typeof ConditionSchema>
export type Step = z.infer<typeof StepSchema>
export type Recipe = z.infer<typeof RecipeSchema>
export type RunStatus = z.infer<typeof RunStatusSchema>
export type Run = z.infer<typeof RunSchema>
export type RunEventType = z.infer<typeof RunEventTypeSchema>
export type RunEvent = z.infer<typeof RunEventSchema>
export type Pack = z.infer<typeof PackSchema>
export type QuokkaExport = z.infer<typeof QuokkaExportSchema>
export type Author = z.infer<typeof AuthorSchema>

// v2 intent-based types
export type ActionStep = z.infer<typeof ActionStepSchema>
export type PageBoundary = z.infer<typeof PageBoundarySchema>
export type RecipeV2Step = ActionStep | PageBoundary
export type RecipeV2 = z.infer<typeof RecipeV2Schema>
export type PlannedAction = z.infer<typeof PlannedActionSchema>
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>
export type PlanningPhase = z.infer<typeof PlanningPhaseSchema>
export type AccessNode = z.infer<typeof AccessNodeSchema>
export type PageSnapshot = z.infer<typeof PageSnapshotSchema>
