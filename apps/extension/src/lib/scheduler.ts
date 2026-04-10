export type ScheduleInterval = 'hourly' | 'daily' | 'weekly'

export interface ScheduledRecipe {
  recipeId: string
  interval: ScheduleInterval
  slotValues: Record<string, string>
  createdAt: string
}

export interface ScheduleRunLog {
  recipeId: string
  startedAt: string
  status: 'completed' | 'failed'
  error?: string
}

const SCHEDULES_KEY = 'quokka_schedules'
const SCHEDULE_RUNS_KEY = 'quokka_schedule_runs'
const ALARM_PREFIX = 'quokka_scheduled_'
const MAX_RUN_LOGS = 100

const INTERVAL_MINUTES: Record<ScheduleInterval, number> = {
  hourly: 60,
  daily: 1440,
  weekly: 10080,
}

/**
 * Schedule a recipe for periodic execution.
 */
export async function scheduleRecipe(
  recipeId: string,
  interval: ScheduleInterval,
  slotValues: Record<string, string> = {},
): Promise<void> {
  const schedules = await getScheduledRecipes()

  // Remove any existing schedule for this recipe
  const filtered = schedules.filter((s) => s.recipeId !== recipeId)

  const entry: ScheduledRecipe = {
    recipeId,
    interval,
    slotValues,
    createdAt: new Date().toISOString(),
  }
  filtered.push(entry)

  await chrome.storage.local.set({ [SCHEDULES_KEY]: filtered })

  // Create the chrome alarm
  const alarmName = `${ALARM_PREFIX}${recipeId}`
  await chrome.alarms.create(alarmName, {
    periodInMinutes: INTERVAL_MINUTES[interval],
  })
}

/**
 * Unschedule a recipe.
 */
export async function unscheduleRecipe(recipeId: string): Promise<void> {
  const schedules = await getScheduledRecipes()
  const filtered = schedules.filter((s) => s.recipeId !== recipeId)
  await chrome.storage.local.set({ [SCHEDULES_KEY]: filtered })

  const alarmName = `${ALARM_PREFIX}${recipeId}`
  await chrome.alarms.clear(alarmName)
}

/**
 * Get all scheduled recipes.
 */
export async function getScheduledRecipes(): Promise<ScheduledRecipe[]> {
  const result = await chrome.storage.local.get(SCHEDULES_KEY)
  const schedules = result[SCHEDULES_KEY]
  return Array.isArray(schedules) ? schedules : []
}

/**
 * Get the schedule for a specific recipe, if any.
 */
export async function getSchedule(recipeId: string): Promise<ScheduledRecipe | undefined> {
  const schedules = await getScheduledRecipes()
  return schedules.find((s) => s.recipeId === recipeId)
}

/**
 * Check if a given alarm name is a Quokka scheduled recipe alarm.
 */
export function isScheduledAlarm(alarmName: string): boolean {
  return alarmName.startsWith(ALARM_PREFIX)
}

/**
 * Extract recipeId from an alarm name.
 */
export function recipeIdFromAlarm(alarmName: string): string {
  return alarmName.slice(ALARM_PREFIX.length)
}

/**
 * Log a schedule run result.
 */
export async function logScheduleRun(log: ScheduleRunLog): Promise<void> {
  const result = await chrome.storage.local.get(SCHEDULE_RUNS_KEY)
  const runs: ScheduleRunLog[] = Array.isArray(result[SCHEDULE_RUNS_KEY])
    ? result[SCHEDULE_RUNS_KEY]
    : []
  runs.push(log)
  // Keep only the most recent entries
  const trimmed = runs.slice(-MAX_RUN_LOGS)
  await chrome.storage.local.set({ [SCHEDULE_RUNS_KEY]: trimmed })
}

/**
 * Get schedule run logs.
 */
export async function getScheduleRuns(): Promise<ScheduleRunLog[]> {
  const result = await chrome.storage.local.get(SCHEDULE_RUNS_KEY)
  return Array.isArray(result[SCHEDULE_RUNS_KEY]) ? result[SCHEDULE_RUNS_KEY] : []
}
