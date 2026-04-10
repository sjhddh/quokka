import {
  MessageType,
  type StartRunPayload,
  type StartLocalReplayPayload,
  type ExecuteStepPayload,
  type CheckpointPendingPayload,
  type CheckpointResponsePayload,
} from '../../lib/messaging'
import { dispatchReplay, type ReplayCallbacks } from '../../runtime/step-dispatcher'
import type { StepResult } from '../../runtime/content-executor'
import * as api from '../../lib/api'

const CHECKPOINT_NOTIFICATION_PREFIX = 'quokka-checkpoint-'

// Pending checkpoint resolvers keyed by runId
const pendingCheckpoints = new Map<string, (approved: boolean) => void>()

// Recording state managed centrally
const recordingState = {
  active: false,
  stepCount: 0,
  tabId: null as number | null,
}

async function handleToggleRecording(): Promise<{
  ok: boolean
  isRecording: boolean
  compiled?: { name: string; stepCount: number }
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('No active tab')

  if (!recordingState.active) {
    // Start recording
    recordingState.active = true
    recordingState.stepCount = 0
    recordingState.tabId = tab.id
    await chrome.tabs.sendMessage(tab.id, { type: MessageType.START_WATCH })
    return { ok: true, isRecording: true }
  } else {
    // Stop recording
    recordingState.active = false
    const targetTab = recordingState.tabId ?? tab.id
    const trace = await chrome.tabs.sendMessage(targetTab, {
      type: MessageType.STOP_WATCH,
    })
    recordingState.tabId = null
    recordingState.stepCount = 0

    if (trace) {
      try {
        const recipe = await api.compileTrace(trace as api.CompileTracePayload)
        return {
          ok: true,
          isRecording: false,
          compiled: { name: recipe.name, stepCount: recipe.steps.length },
        }
      } catch {
        return { ok: true, isRecording: false }
      }
    }
    return { ok: true, isRecording: false }
  }
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { type, payload } = message

    switch (type) {
      case MessageType.START_RUN: {
        const { recipeId, slotValues } = payload as StartRunPayload
        handleStartRun(recipeId, slotValues)
          .then((result) => sendResponse({ ok: true, result }))
          .catch((err) => sendResponse({ ok: false, error: String(err) }))
        return true
      }

      case MessageType.CHECKPOINT_RESPONSE: {
        const { runId, approved } = payload as CheckpointResponsePayload
        const resolver = pendingCheckpoints.get(runId)
        if (resolver) {
          resolver(approved)
          pendingCheckpoints.delete(runId)
          // Clear the notification if one exists
          chrome.notifications.clear(`${CHECKPOINT_NOTIFICATION_PREFIX}${runId}`)
        }
        sendResponse({ ok: true })
        return false
      }

      case MessageType.RESUME_CHECKPOINT: {
        // Legacy: forward approval
        sendResponse({ ok: true })
        return false
      }

      case MessageType.COMPILE_TRACE: {
        api
          .compileTrace(payload as api.CompileTracePayload)
          .then((recipe) =>
            sendResponse({ name: recipe.name, stepCount: recipe.steps.length })
          )
          .catch((err) => sendResponse({ ok: false, error: String(err) }))
        return true
      }

      case MessageType.TOGGLE_RECORDING: {
        handleToggleRecording()
          .then((result) => sendResponse(result))
          .catch((err) => sendResponse({ ok: false, error: String(err) }))
        return true
      }

      case MessageType.GET_RECIPES: {
        api
          .getRecipes()
          .then((recipes) => sendResponse({ ok: true, recipes }))
          .catch(() => sendResponse({ ok: true, recipes: [] }))
        return true
      }

      case MessageType.GET_STATE: {
        sendResponse({
          ok: true,
          isRecording: recordingState.active,
          stepCount: recordingState.stepCount,
        })
        return false
      }

      case MessageType.START_LOCAL_REPLAY: {
        const { recipe, slotValues } = payload as StartLocalReplayPayload
        handleLocalReplay(recipe, slotValues)
          .then((run) => sendResponse({ ok: true, run }))
          .catch((err) => sendResponse({ ok: false, error: String(err) }))
        return true
      }
    }
  })

  // Handle notification button clicks (approve/reject)
  chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (!notificationId.startsWith(CHECKPOINT_NOTIFICATION_PREFIX)) return

    const runId = notificationId.slice(CHECKPOINT_NOTIFICATION_PREFIX.length)
    const resolver = pendingCheckpoints.get(runId)
    if (resolver) {
      // Button 0 = Approve, Button 1 = Reject
      resolver(buttonIndex === 0)
      pendingCheckpoints.delete(runId)
      chrome.notifications.clear(notificationId)
    }
  })
})

function resolveSelector(target: { css?: string; testId?: string; ariaLabel?: string; text?: string }): string {
  if (target.css) return target.css
  if (target.testId) return `[data-testid="${target.testId}"]`
  if (target.ariaLabel) return `[aria-label="${target.ariaLabel}"]`
  if (target.text) return target.text
  return ''
}

async function handleLocalReplay(
  recipe: import('@quokka/shared').Recipe,
  slotValues: Record<string, string>,
): Promise<import('@quokka/shared').Run> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('No active tab')
  const tabId = tab.id

  const callbacks: ReplayCallbacks = {
    onEvent: (event) => {
      // Forward replay events to popup
      chrome.runtime.sendMessage({
        type: MessageType.REPLAY_EVENT,
        payload: { event },
      }).catch(() => {
        // Popup may not be open
      })
    },

    onCheckpoint: async (message) => {
      const runId = `cp_${Date.now()}`

      // Notify popup
      chrome.runtime.sendMessage({
        type: MessageType.CHECKPOINT_PENDING,
        payload: { runId, stepIndex: 0, message } satisfies CheckpointPendingPayload,
      }).catch(() => {})

      // Notification fallback
      chrome.notifications.create(
        `${CHECKPOINT_NOTIFICATION_PREFIX}${runId}`,
        {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon/128.png'),
          title: 'Quokka — Checkpoint',
          message,
          buttons: [{ title: 'Approve' }, { title: 'Reject' }],
          requireInteraction: true,
        }
      )

      return new Promise<boolean>((resolve) => {
        pendingCheckpoints.set(runId, resolve)
      })
    },

    executeStep: async (_tabId, cmd) => {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: MessageType.EXECUTE_STEP,
        payload: cmd satisfies ExecuteStepPayload,
      })
      return response as StepResult
    },
  }

  return dispatchReplay(recipe, slotValues, tabId, callbacks)
}

async function handleStartRun(
  recipeId: string,
  slotValues: Record<string, string>
): Promise<void> {
  const recipe = await api.getRecipe(recipeId)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('No active tab')

  // Generate a runId for checkpoint tracking
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  for (let i = 0; i < recipe.steps.length; i++) {
    const step = recipe.steps[i]

    // Resolve slot templates in values
    const resolve = (val: string): string =>
      val.replace(/\{\{(\w+)\}\}/g, (_, key) => slotValues[key] ?? '')

    switch (step.type) {
      case 'click': {
        const selector = resolveSelector(step.target)
        await chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BRIDGE_CALL,
          payload: { method: 'click', selector },
        })
        break
      }

      case 'type': {
        const selector = step.target.css ?? (step.target.testId
          ? `[data-testid="${step.target.testId}"]`
          : '')
        await chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BRIDGE_CALL,
          payload: { method: 'type', selector, value: resolve(step.value) },
        })
        break
      }

      case 'navigate': {
        await chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BRIDGE_CALL,
          payload: { method: 'navigate', url: resolve(step.url) },
        })
        // Wait for navigation
        await new Promise((r) => setTimeout(r, 1000))
        break
      }

      case 'extract': {
        const selector = step.target.css ?? (step.target.testId
          ? `[data-testid="${step.target.testId}"]`
          : '')
        await chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BRIDGE_CALL,
          payload: { method: 'extract', selector },
        })
        break
      }

      case 'wait': {
        const selector = step.target.css ?? (step.target.testId
          ? `[data-testid="${step.target.testId}"]`
          : '')
        await chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BRIDGE_CALL,
          payload: { method: 'waitFor', selector, timeout: step.timeout },
        })
        break
      }

      case 'checkpoint': {
        const checkpointMessage = step.message ?? 'Checkpoint reached'

        // Send CHECKPOINT_PENDING to popup
        chrome.runtime.sendMessage({
          type: MessageType.CHECKPOINT_PENDING,
          payload: {
            runId,
            stepIndex: i,
            message: checkpointMessage,
          } satisfies CheckpointPendingPayload,
        }).catch(() => {
          // Popup may not be open — notification is the fallback
        })

        // Create a chrome notification as backup
        chrome.notifications.create(
          `${CHECKPOINT_NOTIFICATION_PREFIX}${runId}`,
          {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icon/128.png'),
            title: 'Quokka — Checkpoint',
            message: checkpointMessage,
            buttons: [{ title: 'Approve' }, { title: 'Reject' }],
            requireInteraction: true,
          }
        )

        // Wait for approval/rejection
        const approved = await new Promise<boolean>((resolve) => {
          pendingCheckpoints.set(runId, resolve)
        })

        if (!approved) {
          throw new Error('Checkpoint rejected by user')
        }
        break
      }
    }
  }
}
