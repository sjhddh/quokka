import {
  MessageType,
  type StartRunPayload,
  type StartLocalReplayPayload,
  type ExecuteStepPayload,
  type CheckpointPendingPayload,
  type CheckpointResponsePayload,
  type ImportFromUrlPayload,
  type ActionCapturedPayload,
} from '../../lib/messaging'
import { dispatchReplay, resumeReplay, type ReplayCallbacks } from '../../runtime/step-dispatcher'
import type { StepResult } from '../../runtime/content-executor'
import { checkAuthContext } from '../../runtime/auth-detector'
import * as api from '../../lib/api'
import * as localStorage from '../../lib/local-storage'
import { fetchRecipeFromUrl, decodeRecipeFromUrl, isQuokkaRecipeUrl } from '../../lib/url-import'
import { compileTrace as compileTraceLocal } from '@quokka/core/compiler'
import type { WatchTrace } from '@quokka/core/compiler'
import { DEMO_RECIPES, findStarterForUrl } from '../../lib/demo-recipes'
import { incrementStat } from '../../lib/stats'
import {
  isScheduledAlarm,
  recipeIdFromAlarm,
  getSchedule,
  logScheduleRun,
} from '../../lib/scheduler'
import { getActiveProvider } from '../../lib/llm-storage'
import { IntentRecordingSession } from '../../lib/intent-recording'
import { hasIncompleteRun, loadCheckpoint, clearCheckpoint } from '../../runtime/checkpoint'
import { startKeepalive, stopKeepalive, registerKeepaliveListener } from '../../runtime/keepalive'

const CHECKPOINT_NOTIFICATION_PREFIX = 'quokka-checkpoint-'

// Pending checkpoint resolvers keyed by runId
const pendingCheckpoints = new Map<string, (approved: boolean) => void>()

// Recording state managed centrally
const recordingState = {
  active: false,
  stepCount: 0,
  tabId: null as number | null,
}

// v2 intent extraction session — null when no provider is configured or not recording
let intentSession: IntentRecordingSession | null = null

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

    // Try to initialise v2 intent session if a provider is configured
    intentSession = null
    try {
      const providerConfig = await getActiveProvider()
      if (providerConfig) {
        intentSession = new IntentRecordingSession(providerConfig)
      }
    } catch {
      // No provider — fall back to v1-only recording
    }

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
        await incrementStat('recipesRecorded')

        // If we have intent steps, also build and broadcast a v2 recipe
        if (intentSession && intentSession.stepCount > 0) {
          const tabInfo = await chrome.tabs.get(targetTab)
          const recipeV2 = intentSession.finalize(recipe.name, tabInfo.url ?? '')
          chrome.runtime.sendMessage({
            type: MessageType.RECORDING_COMPLETE_V2,
            payload: { recipe: recipeV2 },
          }).catch(() => {})
        }
        intentSession = null

        return {
          ok: true,
          isRecording: false,
          compiled: { name: recipe.name, stepCount: recipe.steps.length },
        }
      } catch {
        intentSession = null
        return { ok: true, isRecording: false }
      }
    }
    intentSession = null
    return { ok: true, isRecording: false }
  }
}

export default defineBackground(() => {
  // Register keepalive alarm listener — must be registered synchronously at SW startup
  registerKeepaliveListener()

  // On SW startup: check if a recipe run was interrupted and attempt to resume
  hasIncompleteRun().then(async (incomplete) => {
    if (!incomplete) return

    const checkpoint = await loadCheckpoint()
    if (!checkpoint) return

    console.log('[quokka] SW restarted with incomplete run, attempting resume:', checkpoint.runId)

    // Resolve the recipe — local storage first, then companion
    let recipe: import('@quokka/shared').Recipe | undefined
    try {
      recipe = await localStorage.getRecipe(checkpoint.recipeId)
    } catch {
      // ignore
    }
    if (!recipe) {
      try {
        recipe = await api.getRecipe(checkpoint.recipeId)
      } catch {
        // ignore
      }
    }

    if (!recipe) {
      console.warn('[quokka] Resume failed: recipe not found for', checkpoint.recipeId)
      await clearCheckpoint()
      return
    }

    const callbacks: ReplayCallbacks = {
      onEvent: (event) => {
        chrome.runtime.sendMessage({
          type: MessageType.REPLAY_EVENT,
          payload: { event },
        }).catch(() => {})
      },
      onCheckpoint: async (message) => {
        const runId = `cp_${Date.now()}`
        chrome.runtime.sendMessage({
          type: MessageType.CHECKPOINT_PENDING,
          payload: { runId, stepIndex: 0, message } satisfies CheckpointPendingPayload,
        }).catch(() => {})
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
        const response = await chrome.tabs.sendMessage(checkpoint.tabId, {
          type: MessageType.EXECUTE_STEP,
          payload: cmd as unknown as ExecuteStepPayload,
        })
        return response as StepResult
      },
    }

    startKeepalive()
    try {
      await resumeReplay(checkpoint, recipe, callbacks)
    } finally {
      stopKeepalive()
    }
  }).catch((err) => {
    console.error('[quokka] Resume check failed:', err)
  })

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

      case MessageType.ACTION_CAPTURED: {
        // Only process if v2 intent session is active
        if (!intentSession) {
          sendResponse({ ok: true, v2: false })
          return false
        }
        const capture = payload as ActionCapturedPayload
        intentSession.handleAction(capture)
          .then((step) => {
            // Broadcast extracted intent to the pill sidebar
            if (sender.tab?.id) {
              chrome.tabs.sendMessage(sender.tab.id, {
                type: MessageType.INTENT_EXTRACTED,
                payload: { step },
              }).catch(() => {})
            }
            sendResponse({ ok: true, v2: true })
          })
          .catch(() => {
            // Intent extraction failed — v1 recording still intact
            sendResponse({ ok: true, v2: false })
          })
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

      case MessageType.IMPORT_FROM_URL: {
        const { url } = payload as ImportFromUrlPayload
        handleImportFromUrl(url)
          .then((result) => sendResponse({ ok: true, ...result }))
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

  // Detect navigation to .quokka.json URLs and offer import
  chrome.webNavigation?.onCompleted.addListener(async (details) => {
    if (details.frameId !== 0) return // Only main frame
    const url = details.url
    if (!isQuokkaRecipeUrl(url)) return

    try {
      // First try decoding from URL fragment (for quokka.run/import links)
      let recipe = decodeRecipeFromUrl(url)
      if (!recipe) {
        recipe = await fetchRecipeFromUrl(url)
      }
      await localStorage.saveRecipe(recipe)

      // Notify user via Chrome notification
      chrome.notifications.create(`quokka-import-${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon/128.png'),
        title: 'Quokka — Recipe Imported',
        message: `"${recipe.name}" has been imported (${recipe.steps.length} steps).`,
      })
    } catch {
      // Silent failure — user can still import manually
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

  // Handle scheduled recipe alarms
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!isScheduledAlarm(alarm.name)) return

    const recipeId = recipeIdFromAlarm(alarm.name)
    const schedule = await getSchedule(recipeId)
    if (!schedule) return

    try {
      // Resolve recipe from local storage
      const recipe = await localStorage.getRecipe(recipeId)
      if (!recipe) {
        await logScheduleRun({
          recipeId,
          startedAt: new Date().toISOString(),
          status: 'failed',
          error: 'Recipe not found',
        })
        return
      }

      // Open a new tab to the recipe's first navigate URL
      const firstNav = recipe.steps.find((s) => s.type === 'navigate')
      const url = firstNav && 'url' in firstNav ? firstNav.url : 'about:blank'
      const tab = await chrome.tabs.create({ url, active: false })
      if (!tab.id) throw new Error('Failed to create tab')
      const tabId = tab.id

      // Wait for tab to finish loading
      await new Promise<void>((resolve) => {
        const listener = (
          updatedTabId: number,
          info: { status?: string },
        ) => {
          if (updatedTabId === tabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener)
            resolve()
          }
        }
        chrome.tabs.onUpdated.addListener(listener)
      })

      const callbacks: ReplayCallbacks = {
        onEvent: () => {
          // No UI to forward to for scheduled runs
        },
        onCheckpoint: async () => {
          // Auto-approve checkpoints for scheduled runs
          return true
        },
        executeStep: async (_tid, cmd) => {
          const response = await chrome.tabs.sendMessage(tabId, {
            type: MessageType.EXECUTE_STEP,
            payload: cmd as unknown as ExecuteStepPayload,
          })
          return response as StepResult
        },
      }

      const run = await dispatchReplay(recipe, schedule.slotValues, tabId, callbacks)

      await logScheduleRun({
        recipeId,
        startedAt: new Date().toISOString(),
        status: run.status === 'completed' ? 'completed' : 'failed',
        error: run.status === 'failed' ? run.error : undefined,
      })

      // Close the tab after replay
      try {
        await chrome.tabs.remove(tabId)
      } catch {
        // Tab may already be closed
      }
    } catch (err) {
      await logScheduleRun({
        recipeId,
        startedAt: new Date().toISOString(),
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
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

  // Pre-run auth check — non-blocking, sends warnings to UI
  try {
    const authCheck = await checkAuthContext(recipe)
    if (authCheck.warnings.length > 0) {
      chrome.runtime.sendMessage({
        type: MessageType.AUTH_WARNING,
        payload: { warnings: authCheck.warnings },
      }).catch(() => {})
    }
  } catch {
    // Auth check failure should never block a run
  }

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

  await incrementStat('recipesReplayed')
  startKeepalive()
  let run: import('@quokka/shared').Run
  try {
    run = await dispatchReplay(recipe, slotValues, tabId, callbacks)
  } finally {
    stopKeepalive()
  }

  if (run.status === 'completed') {
    await incrementStat('replaySuccessCount')
    // Increment per-recipe runCount in local storage
    try {
      const stored = await localStorage.getRecipe(recipe.id)
      const target = stored ?? recipe
      const meta = target.meta as Record<string, unknown>
      const currentRunCount = typeof meta?.runCount === 'number' ? (meta.runCount as number) : 0
      const updatedRecipe: import('@quokka/shared').Recipe = {
        ...target,
        meta: { ...target.meta, runCount: currentRunCount + 1 },
      }
      await localStorage.saveRecipe(updatedRecipe)
    } catch {
      // Non-critical — don't fail the run for a counter update
    }
  } else if (run.status === 'failed') {
    await incrementStat('replayFailureCount')
  }

  return run
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

async function handleImportFromUrl(url: string): Promise<{ name: string; stepCount: number }> {
  // Try decoding from URL fragment first
  let recipe = decodeRecipeFromUrl(url)
  if (!recipe) {
    recipe = await fetchRecipeFromUrl(url)
  }

  // Save to local storage
  await localStorage.saveRecipe(recipe)

  return { name: recipe.name, stepCount: recipe.steps.length }
}
