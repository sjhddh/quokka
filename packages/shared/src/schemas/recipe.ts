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

export const StepSchema = z.discriminatedUnion('type', [
  ClickStepSchema,
  TypeStepSchema,
  NavigateStepSchema,
  ExtractStepSchema,
  WaitStepSchema,
  CheckpointStepSchema,
])

export const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('0.1.0'),
  hosts: z.array(z.string()),
  slots: z.array(SlotSchema),
  guards: z.array(GuardSchema),
  steps: z.array(StepSchema),
  meta: z.object({
    createdFrom: z.enum(['watch', 'prompt', 'code', 'import']),
    tags: z.array(z.string()),
    pack: z.string().optional(),
  }),
})
