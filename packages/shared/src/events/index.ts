import type { RunEventType, RunEvent } from '../types/index.js'

/** All run event type constants */
export const RUN_EVENT_TYPES = {
  RUN_STARTED: 'run_started',
  STEP_STARTED: 'step_started',
  STEP_SUCCEEDED: 'step_succeeded',
  STEP_FAILED: 'step_failed',
  STEP_PAUSED: 'step_paused',
  STEP_RETRYING: 'step_retrying',
  CHECKPOINT_REQUIRED: 'checkpoint_required',
  CHECKPOINT_APPROVED: 'checkpoint_approved',
  CHECKPOINT_REJECTED: 'checkpoint_rejected',
  GUARD_PASSED: 'guard_passed',
  GUARD_FAILED: 'guard_failed',
  RUN_COMPLETED: 'run_completed',
  RUN_FAILED: 'run_failed',
} as const satisfies Record<string, RunEventType>

/** Typed event map: maps each event type to its corresponding RunEvent */
export interface RunEventMap {
  run_started: RunEvent
  step_started: RunEvent
  step_succeeded: RunEvent
  step_failed: RunEvent
  step_paused: RunEvent
  step_retrying: RunEvent
  checkpoint_required: RunEvent
  checkpoint_approved: RunEvent
  checkpoint_rejected: RunEvent
  guard_passed: RunEvent
  guard_failed: RunEvent
  run_completed: RunEvent
  run_failed: RunEvent
}

/** Type-safe event handler */
export type RunEventHandler<T extends RunEventType = RunEventType> = (
  event: RunEventMap[T],
) => void | Promise<void>
