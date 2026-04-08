import {
  MessageType,
  type StartRunPayload,
  type CheckpointPendingPayload,
  type CheckpointResponsePayload,
} from '../../lib/messaging'
import * as api from '../../lib/api'

const CHECKPOINT_NOTIFICATION_PREFIX = 'quokka-checkpoint-'

// Pending checkpoint resolvers keyed by runId
const pendingCheckpoints = new Map<string, (approved: boolean) => void>()

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
