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

export function sendToBackground<T = unknown>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message)
}

export function sendToContent<T = unknown>(tabId: number, message: Message): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message)
}
