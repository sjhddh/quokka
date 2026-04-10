import { z } from 'zod'

// ---------------------------------------------------------------------------
// ActionStep — intent-based action with optional context hints and verification
// ---------------------------------------------------------------------------
export const ActionStepSchema = z.object({
  id: z.string(),
  type: z.literal('action'),
  intent: z.string(),
  context_hint: z.string().optional(),
  value: z.string().optional(),
  verification: z.string().optional(),
  likelyNavigates: z.boolean(),
})

// ---------------------------------------------------------------------------
// PageBoundary — explicit navigation marker between pages
// ---------------------------------------------------------------------------
export const PageBoundarySchema = z.object({
  id: z.string(),
  type: z.literal('page_boundary'),
  expectedUrl: z.string().optional(),
  waitCondition: z.enum(['networkIdle', 'domContentLoaded', 'load']).optional(),
})

// ---------------------------------------------------------------------------
// RecipeV2 — top-level intent recipe document
// ---------------------------------------------------------------------------
export const RecipeV2Schema = z.object({
  version: z.literal('2.0'),
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  intent: z.string(),
  steps: z.array(z.discriminatedUnion('type', [ActionStepSchema, PageBoundarySchema])),
  variables: z.record(z.string(), z.string()).optional(),
  hosts: z.array(z.string()).optional(),
  meta: z
    .object({
      createdFrom: z.enum(['watch', 'prompt', 'code', 'import']).optional(),
      tags: z.array(z.string()).optional(),
      author: z
        .object({
          name: z.string(),
          url: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
})

// ---------------------------------------------------------------------------
// PlannedAction — a single concrete action output by ExecutionPlanner
// ---------------------------------------------------------------------------
export const PlannedActionSchema = z.object({
  action: z.enum(['click', 'type', 'select', 'scroll', 'wait', 'navigate']),
  selector: z.string(),
  value: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

// ---------------------------------------------------------------------------
// ExecutionPlan — full plan for a single page (maps step ids to actions)
// ---------------------------------------------------------------------------
export const ExecutionPlanSchema = z.object({
  stepId: z.string(),
  actions: z.array(PlannedActionSchema),
})

// ---------------------------------------------------------------------------
// PlanningPhase — plan for one page identified by URL + structural hash
// ---------------------------------------------------------------------------
export const PlanningPhaseSchema = z.object({
  pageUrl: z.string(),
  structuralHash: z.string(),
  plan: z.array(ExecutionPlanSchema),
})

// ---------------------------------------------------------------------------
// AccessNode — a single node in the compressed accessibility tree
// ---------------------------------------------------------------------------
export const AccessNodeSchema = z.object({
  role: z.string(),
  name: z.string(),
  selector: z.string(),
  visible: z.boolean(),
})

// ---------------------------------------------------------------------------
// PageSnapshot — compressed DOM representation sent to LLM for planning
// ---------------------------------------------------------------------------
export const PageSnapshotSchema = z.object({
  url: z.string(),
  title: z.string(),
  structuralHash: z.string(),
  accessibilityTree: z.array(AccessNodeSchema),
})
