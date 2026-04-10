import { create } from 'zustand'
import type { Recipe, Run, RunEvent } from '@quokka/shared'
import * as api from '../lib/api'
import type { ProviderConfig } from '../lib/api'
import * as localStorage from '../lib/local-storage'
import * as llmStorage from '../lib/llm-storage'
import { generateWithProvider } from '../lib/llm-client'
import { sendToBackground, MessageType, type CheckpointPendingPayload, type ReplayEventPayload } from '../lib/messaging'

export interface PendingCheckpoint {
  runId: string
  stepIndex: number
  message: string
}

export interface QuokkaStore {
  recipes: Recipe[]
  currentRun: Run | null
  runEvents: RunEvent[]
  isRecording: boolean
  companionConnected: boolean
  useLocalRuntime: boolean
  pendingCheckpoint: PendingCheckpoint | null
  generatingRecipe: boolean
  generatedRecipe: Recipe | null
  generateError: string | null
  providers: ProviderConfig[]
  activeProviderId: string | null
  _eventSource: EventSource | null
  fetchRecipes: () => Promise<void>
  saveRecipeLocally: (recipe: Recipe) => Promise<void>
  startRun: (recipeId: string, slotValues: Record<string, string>) => Promise<void>
  startLocalReplay: (recipe: Recipe, slotValues: Record<string, string>) => Promise<void>
  setUseLocalRuntime: (useLocal: boolean) => void
  setRecording: (recording: boolean) => void
  approveCheckpoint: () => void
  rejectCheckpoint: () => void
  generateRecipe: (prompt: string, providerId?: string) => Promise<void>
  clearGeneratedRecipe: () => void
  fetchProviders: () => Promise<void>
  saveProvider: (config: ProviderConfig) => Promise<void>
  removeProvider: (id: string) => Promise<void>
  setActiveProvider: (id: string) => Promise<void>
}

export const useQuokkaStore = create<QuokkaStore>((set, get) => ({
  recipes: [],
  currentRun: null,
  runEvents: [],
  isRecording: false,
  companionConnected: false,
  useLocalRuntime: true,
  pendingCheckpoint: null,
  generatingRecipe: false,
  generatedRecipe: null,
  generateError: null,
  providers: [],
  activeProviderId: null,
  _eventSource: null,

  fetchRecipes: async () => {
    try {
      const [localRecipes, companionRecipes, healthy] = await Promise.all([
        localStorage.getRecipes(),
        api.getRecipes().catch(() => [] as Recipe[]),
        api.checkHealth(),
      ])
      // Merge: local recipes first, companion overwrites on ID collision
      const byId = new Map(localRecipes.map((r) => [r.id, r]))
      for (const r of companionRecipes) {
        byId.set(r.id, r)
      }
      set({ recipes: Array.from(byId.values()), companionConnected: healthy })
    } catch {
      // If everything fails, still try to show local recipes
      const localRecipes = await localStorage.getRecipes().catch(() => [] as Recipe[])
      set({ recipes: localRecipes, companionConnected: false })
    }
  },

  saveRecipeLocally: async (recipe: Recipe) => {
    await localStorage.saveRecipe(recipe)
    // Refresh the recipe list
    await get().fetchRecipes()
  },

  startRun: async (recipeId, slotValues) => {
    try {
      const run = await api.createRun(recipeId, slotValues)
      set({ currentRun: run, runEvents: [] })

      // Tell background to orchestrate
      sendToBackground({
        type: MessageType.START_RUN,
        payload: { recipeId, slotValues },
      })

      // Close any previous EventSource
      const prev = get()._eventSource
      if (prev) prev.close()

      // Stream events via SSE
      const streamUrl = api.getEventStreamUrl(run.id)
      const es = new EventSource(streamUrl)
      set({ _eventSource: es })

      es.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as RunEvent
          set((state) => ({
            runEvents: [...state.runEvents, event],
          }))
          // Update currentRun status from terminal events
          if (event.type === 'run_completed') {
            set((state) => ({
              currentRun: state.currentRun ? { ...state.currentRun, status: 'completed' } : null,
            }))
            es.close()
            set({ _eventSource: null })
          } else if (event.type === 'run_failed') {
            set((state) => ({
              currentRun: state.currentRun ? { ...state.currentRun, status: 'failed' } : null,
            }))
            es.close()
            set({ _eventSource: null })
          } else if (event.type === 'run_started') {
            set((state) => ({
              currentRun: state.currentRun ? { ...state.currentRun, status: 'running' } : null,
            }))
          }
        } catch {
          // ignore parse errors
        }
      }

      es.onerror = () => {
        // SSE failed — fall back to polling
        es.close()
        set({ _eventSource: null })
        const poll = setInterval(async () => {
          try {
            const updated = await api.getRun(run.id)
            set({ currentRun: updated })
            if (updated.status === 'completed' || updated.status === 'failed') {
              clearInterval(poll)
            }
          } catch {
            clearInterval(poll)
          }
        }, 1000)
      }
    } catch (err) {
      set({
        currentRun: {
          id: '',
          recipeId,
          status: 'failed',
          slotValues,
          currentStepIndex: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      })
    }
  },

  startLocalReplay: async (recipe, slotValues) => {
    try {
      const run: Run = {
        id: '',
        recipeId: recipe.id,
        status: 'running',
        slotValues,
        currentStepIndex: 0,
      }
      set({ currentRun: run, runEvents: [] })

      const response = await sendToBackground<{ ok: boolean; run?: Run; error?: string }>({
        type: MessageType.START_LOCAL_REPLAY,
        payload: { recipe, slotValues },
      })

      if (response.ok && response.run) {
        set({ currentRun: response.run })
      } else {
        set({
          currentRun: {
            id: '',
            recipeId: recipe.id,
            status: 'failed',
            slotValues,
            currentStepIndex: 0,
            error: response.error ?? 'Local replay failed',
          },
        })
      }
    } catch (err) {
      set({
        currentRun: {
          id: '',
          recipeId: recipe.id,
          status: 'failed',
          slotValues,
          currentStepIndex: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      })
    }
  },

  setUseLocalRuntime: (useLocal) => {
    set({ useLocalRuntime: useLocal })
    // Persist to chrome.storage
    chrome.storage.local.set({ useLocalRuntime: useLocal })
  },

  setRecording: (recording) => set({ isRecording: recording }),

  approveCheckpoint: () => {
    const checkpoint = get().pendingCheckpoint
    if (!checkpoint) return
    sendToBackground({
      type: MessageType.CHECKPOINT_RESPONSE,
      payload: { runId: checkpoint.runId, approved: true },
    })
    set({ pendingCheckpoint: null })
  },

  rejectCheckpoint: () => {
    const checkpoint = get().pendingCheckpoint
    if (!checkpoint) return
    sendToBackground({
      type: MessageType.CHECKPOINT_RESPONSE,
      payload: { runId: checkpoint.runId, approved: false },
    })
    set({ pendingCheckpoint: null })
  },

  generateRecipe: async (prompt, providerId) => {
    set({ generatingRecipe: true, generateError: null, generatedRecipe: null })
    try {
      const recipe = await api.generateRecipe(prompt, providerId)
      set({ generatedRecipe: recipe, generatingRecipe: false })
    } catch (err) {
      set({
        generatingRecipe: false,
        generateError: err instanceof Error ? err.message : 'Generation failed',
      })
    }
  },

  clearGeneratedRecipe: () => set({ generatedRecipe: null, generateError: null }),

  fetchProviders: async () => {
    try {
      const providers = await api.getProviders()
      set({ providers })
    } catch {
      // silently fail
    }
  },

  saveProvider: async (config) => {
    await api.createProvider(config)
    await get().fetchProviders()
  },

  removeProvider: async (id) => {
    await api.deleteProvider(id)
    await get().fetchProviders()
  },
}))

// Listen for messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MessageType.CHECKPOINT_PENDING) {
    const payload = message.payload as CheckpointPendingPayload
    useQuokkaStore.setState({
      pendingCheckpoint: {
        runId: payload.runId,
        stepIndex: payload.stepIndex,
        message: payload.message,
      },
    })
  }

  if (message.type === MessageType.REPLAY_EVENT) {
    const { event } = message.payload as ReplayEventPayload
    useQuokkaStore.setState((state) => ({
      runEvents: [...state.runEvents, event],
      currentRun: state.currentRun
        ? {
            ...state.currentRun,
            status:
              event.type === 'run_completed'
                ? 'completed'
                : event.type === 'run_failed'
                  ? 'failed'
                  : state.currentRun.status,
            currentStepIndex: event.stepIndex ?? state.currentRun.currentStepIndex,
          }
        : null,
    }))
  }
})

// Load persisted useLocalRuntime setting
chrome.storage.local.get('useLocalRuntime', (result) => {
  if (typeof result.useLocalRuntime === 'boolean') {
    useQuokkaStore.setState({ useLocalRuntime: result.useLocalRuntime })
  }
})
