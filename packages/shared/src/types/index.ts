import { z } from 'zod'
import {
  SlotSchema,
  GuardSchema,
  CheckpointSchema,
  LocatorSchema,
  StepSchema,
  RecipeSchema,
} from '../schemas/recipe.js'
import { RunStatusSchema, RunSchema } from '../schemas/run.js'
import { RunEventTypeSchema, RunEventSchema } from '../schemas/event.js'
import { PackSchema } from '../schemas/pack.js'

export type Slot = z.infer<typeof SlotSchema>
export type Guard = z.infer<typeof GuardSchema>
export type Checkpoint = z.infer<typeof CheckpointSchema>
export type Locator = z.infer<typeof LocatorSchema>
export type Step = z.infer<typeof StepSchema>
export type Recipe = z.infer<typeof RecipeSchema>
export type RunStatus = z.infer<typeof RunStatusSchema>
export type Run = z.infer<typeof RunSchema>
export type RunEventType = z.infer<typeof RunEventTypeSchema>
export type RunEvent = z.infer<typeof RunEventSchema>
export type Pack = z.infer<typeof PackSchema>
