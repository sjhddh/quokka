import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock chrome.storage.local and chrome.tabs
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
  tabs: {
    create: vi.fn(() => Promise.resolve()),
  },
})

// Test the rating logic directly (not the React component)
// We replicate the core logic from RatingPrompt.tsx here for unit testing

const RATING_KEY = 'quokka_rating'
const INITIAL_THRESHOLD = 3
const SNOOZE_INCREMENT = 5

interface RatingState {
  dismissed: boolean
  snoozedAt: number
}

async function getRatingState(): Promise<RatingState> {
  const result = await chrome.storage.local.get(RATING_KEY)
  const stored = result[RATING_KEY]
  if (stored && typeof stored === 'object') {
    return stored as RatingState
  }
  return { dismissed: false, snoozedAt: 0 }
}

async function setRatingState(state: RatingState): Promise<void> {
  await chrome.storage.local.set({ [RATING_KEY]: state })
}

function shouldShowPrompt(successCount: number, rating: RatingState): boolean {
  if (rating.dismissed) return false
  if (successCount < INITIAL_THRESHOLD) return false
  if (rating.snoozedAt > 0 && successCount < rating.snoozedAt + SNOOZE_INCREMENT) return false
  return true
}

describe('rating prompt logic', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key]
    }
    vi.clearAllMocks()
  })

  describe('shouldShowPrompt', () => {
    it('does not show before reaching threshold', () => {
      expect(shouldShowPrompt(0, { dismissed: false, snoozedAt: 0 })).toBe(false)
      expect(shouldShowPrompt(1, { dismissed: false, snoozedAt: 0 })).toBe(false)
      expect(shouldShowPrompt(2, { dismissed: false, snoozedAt: 0 })).toBe(false)
    })

    it('shows at threshold of 3', () => {
      expect(shouldShowPrompt(3, { dismissed: false, snoozedAt: 0 })).toBe(true)
    })

    it('shows above threshold', () => {
      expect(shouldShowPrompt(10, { dismissed: false, snoozedAt: 0 })).toBe(true)
    })

    it('does not show when dismissed', () => {
      expect(shouldShowPrompt(10, { dismissed: true, snoozedAt: 0 })).toBe(false)
    })

    it('does not show during snooze period', () => {
      // Snoozed at count 5, so needs to reach 5 + 5 = 10
      expect(shouldShowPrompt(6, { dismissed: false, snoozedAt: 5 })).toBe(false)
      expect(shouldShowPrompt(9, { dismissed: false, snoozedAt: 5 })).toBe(false)
    })

    it('shows again after snooze period expires', () => {
      expect(shouldShowPrompt(10, { dismissed: false, snoozedAt: 5 })).toBe(true)
      expect(shouldShowPrompt(15, { dismissed: false, snoozedAt: 5 })).toBe(true)
    })
  })

  describe('getRatingState', () => {
    it('returns default state when nothing stored', async () => {
      const state = await getRatingState()
      expect(state).toEqual({ dismissed: false, snoozedAt: 0 })
    })

    it('returns stored state', async () => {
      store[RATING_KEY] = { dismissed: true, snoozedAt: 10 }
      const state = await getRatingState()
      expect(state.dismissed).toBe(true)
      expect(state.snoozedAt).toBe(10)
    })
  })

  describe('setRatingState', () => {
    it('persists dismissed state', async () => {
      await setRatingState({ dismissed: true, snoozedAt: 0 })
      expect(store[RATING_KEY]).toEqual({ dismissed: true, snoozedAt: 0 })
    })

    it('persists snooze state', async () => {
      await setRatingState({ dismissed: false, snoozedAt: 7 })
      expect(store[RATING_KEY]).toEqual({ dismissed: false, snoozedAt: 7 })
    })
  })

  describe('snooze flow', () => {
    it('full lifecycle: show -> snooze -> hide -> show again', async () => {
      // Initially at 3 successes, should show
      expect(shouldShowPrompt(3, { dismissed: false, snoozedAt: 0 })).toBe(true)

      // User clicks "Maybe Later" at count 3
      await setRatingState({ dismissed: false, snoozedAt: 3 })
      const state = await getRatingState()

      // Should not show until count reaches 8
      expect(shouldShowPrompt(3, state)).toBe(false)
      expect(shouldShowPrompt(7, state)).toBe(false)

      // At 8, should show again
      expect(shouldShowPrompt(8, state)).toBe(true)
    })

    it('dismiss permanently hides prompt', async () => {
      await setRatingState({ dismissed: true, snoozedAt: 0 })
      const state = await getRatingState()
      expect(shouldShowPrompt(100, state)).toBe(false)
    })
  })
})
