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

  // URL import messages
  IMPORT_FROM_URL = 'IMPORT_FROM_URL',

  // Health check messages
  CHECK_SELECTOR = 'CHECK_SELECTOR',
  HEALTH_CHECK = 'HEALTH_CHECK',

  // Auth warning messages
  AUTH_WARNING = 'AUTH_WARNING',

  // Intent extraction messages (v2 recording flow)
  ACTION_CAPTURED = 'ACTION_CAPTURED',
  INTENT_EXTRACTED = 'INTENT_EXTRACTED',
  RECORDING_COMPLETE_V2 = 'RECORDING_COMPLETE_V2',

  // V2 intent-based replay — DOM capture
  CAPTURE_PAGE_SNAPSHOT = 'CAPTURE_PAGE_SNAPSHOT',
  PAGE_SNAPSHOT_RESULT = 'PAGE_SNAPSHOT_RESULT',
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

export interface ImportFromUrlPayload {
  url: string
}

export interface AuthWarningPayload {
  warnings: string[]
}

export interface ActionCapturedPayload {
  type: 'click' | 'type' | 'navigate' | 'select' | 'scroll'
  element?: {
    tag: string
    text?: string
    ariaLabel?: string
    role?: string
    placeholder?: string
    name?: string
    type?: string
    selector: string
  }
  value?: string
  url?: string
  pageUrl: string
  pageTitle: string
  timestamp: number
}

export interface IntentExtractedPayload {
  step: import('@quokka/core').IntentStep | import('@quokka/core').PageBoundaryStep
}

export interface RecordingCompleteV2Payload {
  recipe: import('@quokka/shared').RecipeV2
}

export interface CapturePageSnapshotPayload {
  // No fields needed — content script captures snapshot of current document
}

export interface PageSnapshotResultPayload {
  snapshot: import('@quokka/core').PageSnapshot
}

export interface CheckSelectorPayload {
  selector: string
  fallbacks?: string[]
}

export interface CheckSelectorResult {
  found: boolean
  count: number
  matchedVia?: string
}

export function sendToBackground<T = unknown>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message)
}

export function sendToContent<T = unknown>(tabId: number, message: Message): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message)
}

/**
 * Convert technical error strings to plain English for non-technical users.
 */
export function humanizeError(
  error: string,
  context?: { stepType?: string; selector?: string },
): string {
  if (!error) return 'Something unexpected happened'

  // Selector / element not found
  if (/selector.*not\s*found|element.*not\s*found|SelectorNotFoundError|no\s*element|cannot\s*find/i.test(error)) {
    const label = friendlySelector(context?.selector)
    if (label) {
      return `Couldn't find the ${label} — the page may have changed`
    }
    return "Couldn't find the element on the page — the page may have changed"
  }

  // Timeout
  if (/timeout|timed?\s*out/i.test(error)) {
    if (context?.stepType === 'navigate' || /navigat/i.test(error)) {
      return 'This page took too long to load'
    }
    if (context?.stepType === 'wait') {
      return 'Waited too long for the page to be ready'
    }
    return 'This step took too long to complete'
  }

  // Navigation errors
  if (/net::ERR_|network|fetch.*fail|connection/i.test(error)) {
    return "Couldn't reach the website — check your internet connection"
  }

  // Permission / access errors
  if (/forbidden|403|401|unauthorized|access\s*denied/i.test(error)) {
    return "The website didn't allow access — you may need to log in first"
  }

  // Generic fallback
  return 'Something unexpected happened'
}

/**
 * Extract a human-readable label from a CSS selector.
 */
function friendlySelector(selector?: string): string {
  if (!selector) return ''

  // aria-label
  const ariaMatch = selector.match(/\[aria-label="([^"]+)"\]/)
  if (ariaMatch) return ariaMatch[1]

  // data-testid
  const testIdMatch = selector.match(/\[data-testid="([^"]+)"\]/)
  if (testIdMatch) return testIdMatch[1].replace(/[-_]/g, ' ')

  // ID selector like #login-btn
  const idMatch = selector.match(/^#([\w-]+)$/)
  if (idMatch) return idMatch[1].replace(/[-_]/g, ' ')

  // text-based selectors or simple tag names
  const textMatch = selector.match(/button|input|link|a\b|select|textarea/i)
  if (textMatch) return textMatch[0].toLowerCase()

  return ''
}

export interface HumanizeStepInput {
  type: string
  description?: string
  target?: { css?: string; text?: string; ariaLabel?: string; testId?: string }
  value?: string
  url?: string
  as?: string
  timeout?: number
}

/**
 * Generate a human-readable description of a step for toast messages.
 * Uses subject-verb-object format: "Clicked the Sign In button"
 */
export function humanizeStep(step: HumanizeStepInput, _index?: number): string {
  // If the step has an explicit description, prefer it
  if (step.description) return step.description

  const label = stepTargetLabel(step)

  switch (step.type) {
    case 'click':
      return label ? `Clicked the ${label}` : 'Clicked an element'
    case 'type': {
      const val = step.value ?? ''
      const preview = val.length > 30 ? val.slice(0, 27) + '...' : val
      return label
        ? `Typed "${preview}" into ${label}`
        : `Typed "${preview}"`
    }
    case 'navigate': {
      const url = step.url ?? ''
      try {
        const hostname = new URL(url).hostname
        return `Navigated to ${hostname}`
      } catch {
        return `Navigated to ${url.slice(0, 40)}${url.length > 40 ? '...' : ''}`
      }
    }
    case 'wait':
      return label
        ? `Waiting for ${label} to appear...`
        : 'Waiting for the page to load...'
    case 'extract':
      return label
        ? `Extracted data from ${label}`
        : 'Extracted data from the page'
    case 'scroll':
      return label
        ? `Scrolled to ${label}`
        : 'Scrolled the page'
    case 'select':
      return label
        ? `Selected "${step.value ?? ''}" in ${label}`
        : `Selected "${step.value ?? ''}"`
    case 'hover':
      return label
        ? `Hovered over ${label}`
        : 'Hovered over an element'
    case 'checkpoint':
      return 'Paused for your confirmation'
    case 'conditional':
      return step.description ?? 'Checking a condition...'
    default:
      return `Performed action: ${step.type}`
  }
}

/**
 * Get a friendly label for a step's target element.
 */
function stepTargetLabel(step: HumanizeStepInput): string {
  const t = step.target
  if (!t) return ''

  if (t.ariaLabel) return `"${t.ariaLabel}"`
  if (t.text) return `"${t.text}"`
  if (t.testId) return t.testId.replace(/[-_]/g, ' ')

  if (t.css) {
    // Try to extract something readable from CSS
    const ariaMatch = t.css.match(/\[aria-label="([^"]+)"\]/)
    if (ariaMatch) return `"${ariaMatch[1]}"`
    const idMatch = t.css.match(/^#([\w-]+)$/)
    if (idMatch) return idMatch[1].replace(/[-_]/g, ' ')
    // Tag-based selectors
    const tagMatch = t.css.match(/^(button|input|select|textarea|a)\b/i)
    if (tagMatch) return `the ${tagMatch[1].toLowerCase()}`
  }

  return ''
}
