import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock chrome.storage.local
const store: Record<string, unknown> = {}

const chromeStorageMock = {
  get: vi.fn((key: string) => {
    return Promise.resolve({ [key]: store[key] })
  }),
  set: vi.fn((items: Record<string, unknown>) => {
    Object.assign(store, items)
    return Promise.resolve()
  }),
}

vi.stubGlobal('chrome', {
  storage: {
    local: chromeStorageMock,
  },
})

import { getStats, incrementStat, type QuokkaStats } from '../lib/stats'

describe('stats', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key]
    }
    vi.clearAllMocks()
  })

  describe('getStats', () => {
    it('returns default stats when nothing stored', async () => {
      const stats = await getStats()
      expect(stats.recipesRecorded).toBe(0)
      expect(stats.recipesReplayed).toBe(0)
      expect(stats.replaySuccessCount).toBe(0)
      expect(stats.replayFailureCount).toBe(0)
      expect(stats.recipesImported).toBe(0)
      expect(stats.recipesExported).toBe(0)
      expect(stats.firstUseDate).toBe('')
      expect(stats.totalTimeSavedEstimate).toBe(0)
    })

    it('returns stored stats merged with defaults', async () => {
      store['quokka_stats'] = { recipesRecorded: 5 }
      const stats = await getStats()
      expect(stats.recipesRecorded).toBe(5)
      expect(stats.recipesReplayed).toBe(0)
    })

    it('returns defaults if stored value is not an object', async () => {
      store['quokka_stats'] = 'bad'
      const stats = await getStats()
      expect(stats.recipesRecorded).toBe(0)
    })
  })

  describe('incrementStat', () => {
    it('increments recipesRecorded', async () => {
      await incrementStat('recipesRecorded')
      const stats = store['quokka_stats'] as QuokkaStats
      expect(stats.recipesRecorded).toBe(1)
    })

    it('increments recipesReplayed', async () => {
      await incrementStat('recipesReplayed')
      await incrementStat('recipesReplayed')
      const stats = store['quokka_stats'] as QuokkaStats
      expect(stats.recipesReplayed).toBe(2)
    })

    it('sets firstUseDate on first increment', async () => {
      await incrementStat('recipesRecorded')
      const stats = store['quokka_stats'] as QuokkaStats
      expect(stats.firstUseDate).toBeTruthy()
      expect(new Date(stats.firstUseDate).getTime()).not.toBeNaN()
    })

    it('does not overwrite firstUseDate on subsequent increments', async () => {
      await incrementStat('recipesRecorded')
      const first = (store['quokka_stats'] as QuokkaStats).firstUseDate
      await incrementStat('recipesRecorded')
      const second = (store['quokka_stats'] as QuokkaStats).firstUseDate
      expect(second).toBe(first)
    })

    it('updates totalTimeSavedEstimate on replaySuccessCount', async () => {
      await incrementStat('replaySuccessCount')
      const stats = store['quokka_stats'] as QuokkaStats
      expect(stats.totalTimeSavedEstimate).toBe(30)
    })

    it('accumulates time saved over multiple successes', async () => {
      await incrementStat('replaySuccessCount')
      await incrementStat('replaySuccessCount')
      await incrementStat('replaySuccessCount')
      const stats = store['quokka_stats'] as QuokkaStats
      expect(stats.replaySuccessCount).toBe(3)
      expect(stats.totalTimeSavedEstimate).toBe(90)
    })

    it('does not update totalTimeSavedEstimate for non-success keys', async () => {
      await incrementStat('replayFailureCount')
      const stats = store['quokka_stats'] as QuokkaStats
      expect(stats.totalTimeSavedEstimate).toBe(0)
    })

    it('increments recipesImported', async () => {
      await incrementStat('recipesImported')
      await incrementStat('recipesImported')
      const stats = store['quokka_stats'] as QuokkaStats
      expect(stats.recipesImported).toBe(2)
    })

    it('increments recipesExported', async () => {
      await incrementStat('recipesExported')
      const stats = store['quokka_stats'] as QuokkaStats
      expect(stats.recipesExported).toBe(1)
    })
  })
})
