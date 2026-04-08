import { z } from 'zod'

export const RunStatusSchema = z.enum([
  'idle',
  'planning',
  'running',
  'checkpoint_wait',
  'completed',
  'failed',
])

export const RunSchema = z.object({
  id: z.string(),
  recipeId: z.string(),
  status: RunStatusSchema,
  slotValues: z.record(z.string(), z.string()),
  currentStepIndex: z.number().default(0),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  error: z.string().optional(),
})
