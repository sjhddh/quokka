const STATS_KEY = 'quokka_stats'

export interface QuokkaStats {
  recipesRecorded: number
  recipesReplayed: number
  replaySuccessCount: number
  replayFailureCount: number
  recipesImported: number
  recipesExported: number
  firstUseDate: string
  totalTimeSavedEstimate: number
}

const DEFAULT_STATS: QuokkaStats = {
  recipesRecorded: 0,
  recipesReplayed: 0,
  replaySuccessCount: 0,
  replayFailureCount: 0,
  recipesImported: 0,
  recipesExported: 0,
  firstUseDate: '',
  totalTimeSavedEstimate: 0,
}

/** Seconds saved per successful replay (rough estimate). */
const SECONDS_PER_REPLAY = 30

export async function getStats(): Promise<QuokkaStats> {
  const result = await chrome.storage.local.get(STATS_KEY)
  const stored = result[STATS_KEY]
  if (stored && typeof stored === 'object') {
    return { ...DEFAULT_STATS, ...stored } as QuokkaStats
  }
  return { ...DEFAULT_STATS }
}

export async function incrementStat(
  key: keyof Omit<QuokkaStats, 'firstUseDate' | 'totalTimeSavedEstimate'>,
): Promise<void> {
  const stats = await getStats()

  // Set firstUseDate on first ever increment
  if (!stats.firstUseDate) {
    stats.firstUseDate = new Date().toISOString()
  }

  stats[key] = (stats[key] as number) + 1

  // Update time saved estimate on successful replay
  if (key === 'replaySuccessCount') {
    stats.totalTimeSavedEstimate = stats.replaySuccessCount * SECONDS_PER_REPLAY
  }

  await chrome.storage.local.set({ [STATS_KEY]: stats })
}
