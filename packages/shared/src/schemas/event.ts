import { z } from 'zod'

export const RunEventTypeSchema = z.enum([
  'run_started',
  'step_started',
  'step_succeeded',
  'step_failed',
  'step_paused',
  'step_retrying',
  'checkpoint_required',
  'checkpoint_approved',
  'checkpoint_rejected',
  'guard_passed',
  'guard_failed',
  'run_completed',
  'run_failed',
])

export const RunEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  type: RunEventTypeSchema,
  stepIndex: z.number().optional(),
  payload: z.unknown().optional(),
  timestamp: z.string(),
})
