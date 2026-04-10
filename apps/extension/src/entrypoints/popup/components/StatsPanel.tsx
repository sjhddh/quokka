import { useState, useEffect } from 'react'
import { getStats, type QuokkaStats } from '../../../lib/stats'

function formatTimeSaved(seconds: number): string {
  if (seconds < 60) return `~${seconds}s saved`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `~${minutes} minute${minutes !== 1 ? 's' : ''} saved`
  const hours = Math.round(minutes / 60)
  return `~${hours} hour${hours !== 1 ? 's' : ''} saved`
}

function successRate(stats: QuokkaStats): string {
  const total = stats.replaySuccessCount + stats.replayFailureCount
  if (total === 0) return '--'
  return `${Math.round((stats.replaySuccessCount / total) * 100)}%`
}

export default function StatsPanel() {
  const [stats, setStats] = useState<QuokkaStats | null>(null)

  useEffect(() => {
    getStats().then(setStats)
  }, [])

  if (!stats) return null

  const items = [
    { label: 'Recipes recorded', value: stats.recipesRecorded },
    { label: 'Replays run', value: stats.recipesReplayed },
    { label: 'Success rate', value: successRate(stats) },
    { label: 'Time saved', value: formatTimeSaved(stats.totalTimeSavedEstimate) },
  ]

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Usage Stats</h3>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-white border border-gray-200 rounded-md px-3 py-2"
          >
            <div className="text-lg font-semibold text-gray-800">{item.value}</div>
            <div className="text-[11px] text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
