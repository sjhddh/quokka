import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock chrome.storage.local and chrome.alarms
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

const alarmsCreated: Record<string, { periodInMinutes: number }> = {}
const alarmsCleared: string[] = []

const chromeAlarmsMock = {
  create: vi.fn((name: string, info: { periodInMinutes: number }) => {
    alarmsCreated[name] = info
    return Promise.resolve()
  }),
  clear: vi.fn((name: string) => {
    alarmsCleared.push(name)
    delete alarmsCreated[name]
    return Promise.resolve(true)
  }),
}

vi.stubGlobal('chrome', {
  storage: { local: chromeStorageMock },
  alarms: chromeAlarmsMock,
})

// Import after mocking
import {
  scheduleRecipe,
  unscheduleRecipe,
  getScheduledRecipes,
  getSchedule,
  isScheduledAlarm,
  recipeIdFromAlarm,
  logScheduleRun,
  getScheduleRuns,
} from '../lib/scheduler'

describe('scheduler', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key]
    for (const key of Object.keys(alarmsCreated)) delete alarmsCreated[key]
    alarmsCleared.length = 0
    vi.clearAllMocks()
  })

  describe('scheduleRecipe', () => {
    it('creates a schedule entry and alarm', async () => {
      await scheduleRecipe('recipe-1', 'daily')

      const schedules = await getScheduledRecipes()
      expect(schedules).toHaveLength(1)
      expect(schedules[0].recipeId).toBe('recipe-1')
      expect(schedules[0].interval).toBe('daily')

      expect(chromeAlarmsMock.create).toHaveBeenCalledWith(
        'quokka_scheduled_recipe-1',
        { periodInMinutes: 1440 },
      )
    })

    it('uses correct intervals for hourly/weekly', async () => {
      await scheduleRecipe('r1', 'hourly')
      expect(chromeAlarmsMock.create).toHaveBeenCalledWith(
        'quokka_scheduled_r1',
        { periodInMinutes: 60 },
      )

      await scheduleRecipe('r2', 'weekly')
      expect(chromeAlarmsMock.create).toHaveBeenCalledWith(
        'quokka_scheduled_r2',
        { periodInMinutes: 10080 },
      )
    })

    it('replaces existing schedule for same recipe', async () => {
      await scheduleRecipe('r1', 'daily')
      await scheduleRecipe('r1', 'hourly')

      const schedules = await getScheduledRecipes()
      expect(schedules).toHaveLength(1)
      expect(schedules[0].interval).toBe('hourly')
    })

    it('stores slotValues', async () => {
      await scheduleRecipe('r1', 'daily', { email: 'test@test.com' })
      const schedule = await getSchedule('r1')
      expect(schedule?.slotValues).toEqual({ email: 'test@test.com' })
    })
  })

  describe('unscheduleRecipe', () => {
    it('removes a schedule and clears the alarm', async () => {
      await scheduleRecipe('r1', 'daily')
      await unscheduleRecipe('r1')

      const schedules = await getScheduledRecipes()
      expect(schedules).toHaveLength(0)
      expect(chromeAlarmsMock.clear).toHaveBeenCalledWith('quokka_scheduled_r1')
    })

    it('handles unscheduling a non-existent recipe', async () => {
      await unscheduleRecipe('missing')
      const schedules = await getScheduledRecipes()
      expect(schedules).toHaveLength(0)
    })
  })

  describe('getSchedule', () => {
    it('returns the schedule for a specific recipe', async () => {
      await scheduleRecipe('r1', 'daily')
      await scheduleRecipe('r2', 'weekly')

      const s = await getSchedule('r1')
      expect(s?.interval).toBe('daily')
    })

    it('returns undefined if not scheduled', async () => {
      const s = await getSchedule('missing')
      expect(s).toBeUndefined()
    })
  })

  describe('alarm name helpers', () => {
    it('isScheduledAlarm detects quokka alarm names', () => {
      expect(isScheduledAlarm('quokka_scheduled_r1')).toBe(true)
      expect(isScheduledAlarm('other-alarm')).toBe(false)
    })

    it('recipeIdFromAlarm extracts recipe ID', () => {
      expect(recipeIdFromAlarm('quokka_scheduled_my-recipe')).toBe('my-recipe')
    })
  })

  describe('schedule run logging', () => {
    it('logs a run result', async () => {
      await logScheduleRun({
        recipeId: 'r1',
        startedAt: '2026-01-01T00:00:00Z',
        status: 'completed',
      })

      const runs = await getScheduleRuns()
      expect(runs).toHaveLength(1)
      expect(runs[0].status).toBe('completed')
    })

    it('logs failed runs with error', async () => {
      await logScheduleRun({
        recipeId: 'r1',
        startedAt: '2026-01-01T00:00:00Z',
        status: 'failed',
        error: 'Tab crashed',
      })

      const runs = await getScheduleRuns()
      expect(runs[0].error).toBe('Tab crashed')
    })

    it('trims to 100 entries', async () => {
      // Seed 100 existing entries
      const existing = Array.from({ length: 100 }, (_, i) => ({
        recipeId: `r${i}`,
        startedAt: '2026-01-01T00:00:00Z',
        status: 'completed' as const,
      }))
      store['quokka_schedule_runs'] = existing

      await logScheduleRun({
        recipeId: 'r-new',
        startedAt: '2026-01-02T00:00:00Z',
        status: 'completed',
      })

      const runs = await getScheduleRuns()
      expect(runs).toHaveLength(100)
      expect(runs[runs.length - 1].recipeId).toBe('r-new')
      // First entry should have been trimmed
      expect(runs[0].recipeId).toBe('r1')
    })
  })
})
