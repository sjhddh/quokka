import { useState } from 'react'
import { useQuokkaStore } from '../../../store'
import SlotForm from './SlotForm'

export default function QuickRun() {
  const recipes = useQuokkaStore((s) => s.recipes)
  const currentRun = useQuokkaStore((s) => s.currentRun)
  const startRun = useQuokkaStore((s) => s.startRun)
  const startLocalReplay = useQuokkaStore((s) => s.startLocalReplay)
  const useLocalRuntime = useQuokkaStore((s) => s.useLocalRuntime)
  const companionConnected = useQuokkaStore((s) => s.companionConnected)
  const authWarnings = useQuokkaStore((s) => s.authWarnings)

  const [selectedId, setSelectedId] = useState('')
  const [slotValues, setSlotValues] = useState<Record<string, string>>({})

  const selectedRecipe = recipes.find((r) => r.id === selectedId)
  const status = currentRun?.status ?? 'idle'

  const handleRun = async () => {
    if (!selectedId) return

    // Use local runtime if enabled, or if companion is not connected
    if (useLocalRuntime || !companionConnected) {
      if (selectedRecipe) {
        await startLocalReplay(selectedRecipe, slotValues)
        return
      }
    }

    await startRun(selectedId, slotValues)
  }

  const statusColors: Record<string, string> = {
    idle: 'text-gray-400',
    planning: 'text-yellow-500',
    running: 'text-blue-500',
    checkpoint_wait: 'text-orange-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
  }

  return (
    <div className="space-y-3">
      {/* Recipe selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Recipe</label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value)
            setSlotValues({})
          }}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Select a recipe...</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Slot form */}
      {selectedRecipe && (
        <SlotForm
          slots={selectedRecipe.slots}
          values={slotValues}
          onChange={setSlotValues}
        />
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={!selectedId || status === 'running'}
        className="w-full py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === 'running' ? 'Running...' : 'Run'}
      </button>

      {/* Auth warnings */}
      {authWarnings.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 space-y-1">
          {authWarnings.map((w, i) => (
            <div key={i}>&#9888; {w}</div>
          ))}
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">Status:</span>
        <span className={`font-medium ${statusColors[status] ?? 'text-gray-400'}`}>
          {status}
        </span>
        {currentRun?.error && (
          <span className="text-red-500 truncate" title={currentRun.error}>
            {currentRun.error}
          </span>
        )}
      </div>
    </div>
  )
}
