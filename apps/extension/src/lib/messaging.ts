export enum MessageType {
  // Background messages
  START_RUN = 'START_RUN',
  RESUME_CHECKPOINT = 'RESUME_CHECKPOINT',
  COMPILE_TRACE = 'COMPILE_TRACE',

  // Checkpoint flow
  CHECKPOINT_PENDING = 'CHECKPOINT_PENDING',
  CHECKPOINT_RESPONSE = 'CHECKPOINT_RESPONSE',

  // Content script messages
  BRIDGE_CALL = 'BRIDGE_CALL',
  START_WATCH = 'START_WATCH',
  STOP_WATCH = 'STOP_WATCH',

  // Pill messages
  TOGGLE_RECORDING = 'TOGGLE_RECORDING',
  GET_RECIPES = 'GET_RECIPES',
  GET_STATE = 'GET_STATE',
  RECORDING_EVENT = 'RECORDING_EVENT',
  RUN_PROGRESS = 'RUN_PROGRESS',

  // Local runtime messages (extension-only replay)
  START_LOCAL_REPLAY = 'START_LOCAL_REPLAY',
  EXECUTE_STEP = 'EXECUTE_STEP',
  STEP_COMPLETE = 'STEP_COMPLETE',
  STEP_FAILED = 'STEP_FAILED',
  REPLAY_COMPLETE = 'REPLAY_COMPLETE',
  REPLAY_EVENT = 'REPLAY_EVENT',

  // Failure handling messages
  STEP_PAUSED = 'STEP_PAUSED',
  STEP_PAUSE_RESPONSE = 'STEP_PAUSE_RESPONSE',
  SHOW_FAILURE_OVERLAY = 'SHOW_FAILURE_OVERLAY',
  HIDE_FAILURE_OVERLAY = 'HIDE_FAILURE_OVERLAY',
}

export interface Message {
  type: MessageType
  payload?: unknown
}

export interface BridgeCallPayload {
  method: 'click' | 'type' | 'navigate' | 'extract' | 'waitFor'
  selector?: string
  value?: string
  url?: string
  timeout?: number
}

export interface StartRunPayload {
  recipeId: string
  slotValues: Record<string, string>
}

export interface CheckpointPendingPayload {
  runId: string
  stepIndex: number
  message: string
}

export interface CheckpointResponsePayload {
  runId: string
  approved: boolean
}

export interface StartLocalReplayPayload {
  recipe: import('@quokka/shared').Recipe
  slotValues: Record<string, string>
}

export interface ExecuteStepPayload {
  type: 'click' | 'type' | 'navigate' | 'extract' | 'wait'
  locator?: import('@quokka/shared').Locator
  value?: string
  url?: string
  timeout?: number
  slotValues?: Record<string, string>
}

export interface ReplayEventPayload {
  event: import('@quokka/shared').RunEvent
}

export interface StepPausedPayload {
  runId: string
  stepIndex: number
  stepType: string
  selector: string
  error: string
  fallbacksAttempted: string[]
  options: ('retry' | 'skip' | 'fix')[]
}

export interface StepPauseResponsePayload {
  runId: string
  action: 'retry' | 'skip' | 'fix'
}

export interface ShowFailureOverlayPayload {
  selector: string
  stepIndex: number
  error: string
}

export function sendToBackground<T = unknown>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message)
}

export function sendToContent<T = unknown>(tabId: number, message: Message): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message)
}
