import type { RunStatus } from '@quokka/shared'

type TransitionMap = Record<string, Record<string, RunStatus>>

const transitions: TransitionMap = {
  idle: {
    start: 'planning',
  },
  planning: {
    plan_complete: 'running',
  },
  running: {
    checkpoint: 'checkpoint_wait',
    complete: 'completed',
  },
  checkpoint_wait: {
    approve: 'running',
    reject: 'failed',
  },
}

const globalTransitions: Record<string, RunStatus> = {
  error: 'failed',
}

export function transition(current: RunStatus, event: string): RunStatus {
  // Check global transitions first
  if (globalTransitions[event] !== undefined) {
    return globalTransitions[event]
  }

  const stateTransitions = transitions[current]
  if (stateTransitions && stateTransitions[event] !== undefined) {
    return stateTransitions[event]
  }

  throw new Error(`Invalid transition: ${current} + "${event}"`)
}
