import { create } from 'zustand'
import type { Recipe, Run, RunEvent } from '@quokka/shared'
import * as api from '../lib/api'
import { sendToBackground, MessageType } from '../lib/messaging'

export interface QuokkaStore {
  recipes: Recipe[]
  currentRun: Run | null
  runEvents: RunEvent[]
  isRecording: boolean
  companionConnected: boolean
  fetchRecipes: () => Promise<void>
  startRun: (recipeId: string, slotValues: Record<string, string>) => Promise<void>
  setRecording: (recording: boolean) => void
}

export const useQuokkaStore = create<QuokkaStore>((set) => ({
  recipes: [],
  currentRun: null,
  runEvents: [],
  isRecording: false,
  companionConnected: false,

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
      set({ currentRun: run })

      // Tell background to orchestrate
      sendToBackground({
        type: MessageType.START_RUN,
        payload: { recipeId, slotValues },
      })

      // Poll for status updates
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
}))
