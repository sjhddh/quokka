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
import * as localStorage from '../../lib/local-storage'
import { compileTrace as compileTraceLocal } from '@quokka/core/compiler'
import type { WatchTrace } from '@quokka/core/compiler'
import { DEMO_RECIPES, findStarterForUrl } from '../../lib/demo-recipes'

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
        const recipe = compileTraceLocal(trace as WatchTrace)
        await localStorage.saveRecipe(recipe)
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
          .then((run) => sendResponse({ ok: true, run }))
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
        try {
          const recipe = compileTraceLocal(payload as WatchTrace)
          localStorage.saveRecipe(recipe)
            .then(() => sendResponse({ name: recipe.name, stepCount: recipe.steps.length }))
            .catch((err) => sendResponse({ ok: false, error: String(err) }))
        } catch (err) {
          sendResponse({ ok: false, error: String(err) })
        }
        return true
      }

      case MessageType.TOGGLE_RECORDING: {
        handleToggleRecording()
          .then((result) => sendResponse(result))
          .catch((err) => sendResponse({ ok: false, error: String(err) }))
        return true
      }

      case MessageType.GET_RECIPES: {
        Promise.all([
          localStorage.getRecipes(),
          api.getRecipes().catch(() => [] as import('@quokka/shared').Recipe[]),
        ])
          .then(([localRecipes, companionRecipes]) => {
            // Merge: companion recipes win on ID collision
            const byId = new Map(localRecipes.map((r) => [r.id, r]))
            for (const r of companionRecipes) {
              byId.set(r.id, r)
            }
            sendResponse({ ok: true, recipes: Array.from(byId.values()) })
          })
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

  // Seed demo recipes & domain-aware starter on first install
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason !== 'install') return

    // Save demo recipes
    for (const recipe of DEMO_RECIPES) {
      await localStorage.saveRecipe(recipe)
    }

    // Check active tab for domain-aware starter suggestion
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const suggestion = findStarterForUrl(tab.url)
        if (suggestion) {
          await localStorage.saveRecipe(suggestion.recipe)
        }
      }
    } catch {
      // Tab query can fail in some contexts — ignore
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
): Promise<import('@quokka/shared').Run> {
  // Resolve recipe: try companion first, fall back to local storage
  let recipe: import('@quokka/shared').Recipe
  try {
    recipe = await api.getRecipe(recipeId)
  } catch {
    const local = await localStorage.getRecipe(recipeId)
    if (!local) throw new Error(`Recipe ${recipeId} not found`)
    recipe = local
  }

  // Delegate to the local replay runtime (same path as START_LOCAL_REPLAY)
  return handleLocalReplay(recipe, slotValues)
}
