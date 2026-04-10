import { z } from 'zod'

export const SlotSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['string', 'number', 'date', 'boolean']),
  default: z.string().optional(),
})

export const GuardSchema = z.object({
  type: z.enum(['dom', 'url', 'text']),
  selector: z.string().optional(),
  expect: z.string(),
  timeout: z.number().default(5000),
})

export const CheckpointSchema = z.object({
  message: z.string(),
  requiresHuman: z.boolean().default(true),
})

export const LocatorSchema = z.object({
  css: z.string().optional(),
  text: z.string().optional(),
  ariaLabel: z.string().optional(),
  testId: z.string().optional(),
  fallbackSelectors: z.array(z.string()).optional(),
})

const ClickStepSchema = z.object({
  type: z.literal('click'),
  target: LocatorSchema,
  description: z.string().optional(),
})

const TypeStepSchema = z.object({
  type: z.literal('type'),
  target: LocatorSchema,
  value: z.string(),
  description: z.string().optional(),
})

const NavigateStepSchema = z.object({
  type: z.literal('navigate'),
  url: z.string(),
  description: z.string().optional(),
})

const ExtractStepSchema = z.object({
  type: z.literal('extract'),
  target: LocatorSchema,
  as: z.string(),
  description: z.string().optional(),
})

const WaitStepSchema = z.object({
  type: z.literal('wait'),
  target: LocatorSchema,
  timeout: z.number().optional(),
  description: z.string().optional(),
})

const CheckpointStepSchema = z.object({
  type: z.literal('checkpoint'),
  message: z.string(),
  description: z.string().optional(),
})

const ScrollStepSchema = z.object({
  type: z.literal('scroll'),
  target: LocatorSchema,
  description: z.string().optional(),
})

const SelectStepSchema = z.object({
  type: z.literal('select'),
  target: LocatorSchema,
  value: z.string(),
  description: z.string().optional(),
})

const HoverStepSchema = z.object({
  type: z.literal('hover'),
  target: LocatorSchema,
  description: z.string().optional(),
})

export const ConditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('element_exists'),
    target: LocatorSchema,
  }),
  z.object({
    type: z.literal('element_not_exists'),
    target: LocatorSchema,
  }),
  z.object({
    type: z.literal('url_matches'),
    pattern: z.string(),
  }),
])

// Base step schemas (non-recursive)
const BaseStepSchemas = [
  ClickStepSchema,
  TypeStepSchema,
  NavigateStepSchema,
  ExtractStepSchema,
  WaitStepSchema,
  CheckpointStepSchema,
  ScrollStepSchema,
  SelectStepSchema,
  HoverStepSchema,
] as const

// Use z.lazy for the conditional step since it references StepSchema recursively
const ConditionalStepSchema = z.object({
  type: z.literal('conditional'),
  condition: ConditionSchema,
  thenSteps: z.lazy(() => z.array(StepSchema)),
  elseSteps: z.lazy(() => z.array(StepSchema)).optional(),
  description: z.string().optional(),
})

export const StepSchema: z.ZodType<
  | z.infer<typeof ClickStepSchema>
  | z.infer<typeof TypeStepSchema>
  | z.infer<typeof NavigateStepSchema>
  | z.infer<typeof ExtractStepSchema>
  | z.infer<typeof WaitStepSchema>
  | z.infer<typeof CheckpointStepSchema>
  | z.infer<typeof ScrollStepSchema>
  | z.infer<typeof SelectStepSchema>
  | z.infer<typeof HoverStepSchema>
  | {
      type: 'conditional'
      condition: z.infer<typeof ConditionSchema>
      thenSteps: z.infer<typeof StepSchema>[]
      elseSteps?: z.infer<typeof StepSchema>[]
      description?: string
    }
> = z.union([
  z.discriminatedUnion('type', [...BaseStepSchemas]),
  ConditionalStepSchema,
])

/** Allowlisted step types for security verification */
export const ALLOWED_STEP_TYPES = [
  'navigate', 'click', 'type', 'wait', 'extract',
  'scroll', 'select', 'hover', 'checkpoint', 'conditional',
] as const

export const AuthorSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
})

export const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('0.1.0'),
  schemaVersion: z.literal(1).default(1),
  integrity: z.string().optional(),
  author: AuthorSchema.optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
  hosts: z.array(z.string()),
  slots: z.array(SlotSchema),
  guards: z.array(GuardSchema),
  steps: z.array(StepSchema),
  meta: z.object({
    createdFrom: z.enum(['watch', 'prompt', 'code', 'import']),
    tags: z.array(z.string()),
    pack: z.string().optional(),
    isDemo: z.boolean().optional(),
    suggestedFor: z.string().optional(),
    author: AuthorSchema.optional(),
    runCount: z.number().optional(),
    description: z.string().optional(),
  }),
})

export const QuokkaExportSchema = z.object({
  quokka_version: z.string(),
  exported_at: z.string(),
  recipe: RecipeSchema,
})
