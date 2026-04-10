import type { RunEvent } from '@quokka/shared'

const CHECKPOINT_KEY = 'quokka_execution_checkpoint'

function hasStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local
}

export interface ExecutionCheckpoint {
  runId: string
  recipeId: string
  recipeName: string
  recipeVersion: string
  slotValues: Record<string, string>
  tabId: number
  currentStepIndex: number
  totalSteps: number
  status: 'running' | 'paused' | 'recovering'
  startedAt: string
  lastStepAt: string
  events: RunEvent[]
  // v2-specific
  currentPhaseIndex?: number
  cachedPlans?: Record<string, unknown>
}

/**
 * Save checkpoint after each step. Uses chrome.storage.local for persistence
 * across service worker restarts.
 */
export async function saveCheckpoint(checkpoint: ExecutionCheckpoint): Promise<void> {
  if (!hasStorage()) return
  await chrome.storage.local.set({ [CHECKPOINT_KEY]: checkpoint })
}

/**
 * Load checkpoint on SW startup. Returns null if no checkpoint exists.
 */
export async function loadCheckpoint(): Promise<ExecutionCheckpoint | null> {
  if (!hasStorage()) return null
  const result = await chrome.storage.local.get(CHECKPOINT_KEY)
  return (result[CHECKPOINT_KEY] as ExecutionCheckpoint) ?? null
}

/**
 * Clear checkpoint on run completion or failure.
 */
export async function clearCheckpoint(): Promise<void> {
  if (!hasStorage()) return
  await chrome.storage.local.remove(CHECKPOINT_KEY)
}

/**
 * Returns true if there's a checkpoint with status 'running' or 'recovering'
 * that may need to be resumed.
 */
export async function hasIncompleteRun(): Promise<boolean> {
  const checkpoint = await loadCheckpoint()
  return checkpoint !== null && (checkpoint.status === 'running' || checkpoint.status === 'recovering')
}
