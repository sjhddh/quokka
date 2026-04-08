import { create } from 'zustand'
import type { Recipe, Run, RunEvent } from '@quokka/shared'
import * as api from '../lib/api'
import type { ProviderConfig } from '../lib/api'
import { sendToBackground, MessageType, type CheckpointPendingPayload } from '../lib/messaging'

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
  pendingCheckpoint: PendingCheckpoint | null
  generatingRecipe: boolean
  generatedRecipe: Recipe | null
  generateError: string | null
  providers: ProviderConfig[]
  _eventSource: EventSource | null
  fetchRecipes: () => Promise<void>
  startRun: (recipeId: string, slotValues: Record<string, string>) => Promise<void>
  setRecording: (recording: boolean) => void
  approveCheckpoint: () => void
  rejectCheckpoint: () => void
  generateRecipe: (prompt: string, providerId?: string) => Promise<void>
  clearGeneratedRecipe: () => void
  fetchProviders: () => Promise<void>
  saveProvider: (config: ProviderConfig) => Promise<void>
  removeProvider: (id: string) => Promise<void>
}

export const useQuokkaStore = create<QuokkaStore>((set, get) => ({
  recipes: [],
  currentRun: null,
  runEvents: [],
  isRecording: false,
  companionConnected: false,
  pendingCheckpoint: null,
  generatingRecipe: false,
  generatedRecipe: null,
  generateError: null,
  providers: [],
  _eventSource: null,

  fetchRecipes: async () => {
    try {
      const [recipes, healthy] = await Promise.all([
        api.getRecipes().catch(() => [] as Recipe[]),
        api.checkHealth(),
      ])
      set({ recipes, companionConnected: healthy })
    } catch {
      set({ companionConnected: false })
    }
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

// Listen for CHECKPOINT_PENDING messages from background
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
})
