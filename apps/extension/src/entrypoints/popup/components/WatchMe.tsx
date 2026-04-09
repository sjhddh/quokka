import { useState } from 'react'
import { useQuokkaStore } from '../../../store'
import { sendToBackground, MessageType } from '../../../lib/messaging'

interface CompiledResult {
  name: string
  stepCount: number
}

export default function WatchMe() {
  const isRecording = useQuokkaStore((s) => s.isRecording)
  const setRecording = useQuokkaStore((s) => s.setRecording)

  const [compiled, setCompiled] = useState<CompiledResult | null>(null)
  const [saving, setSaving] = useState(false)

  const handleToggle = async () => {
    if (!isRecording) {
      // Start recording
      setCompiled(null)
      setRecording(true)
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: MessageType.START_WATCH })
      }
    } else {
      // Stop recording and compile
      setRecording(false)
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        const trace = await chrome.tabs.sendMessage(tab.id, {
          type: MessageType.STOP_WATCH,
        })
        if (trace) {
          const result = await sendToBackground({
            type: MessageType.COMPILE_TRACE,
            payload: trace,
          })
          if (result) {
            setCompiled(result as CompiledResult)
          }
        }
      }
    }
  }

  const handleSave = async () => {
    if (!compiled) return
    setSaving(true)
    try {
      // Save is handled during compile -- this is a confirmation UX
      setSaving(false)
      setCompiled(null)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Record your browser actions and Quokka will turn them into a reusable recipe.
      </p>

      {/* Record toggle */}
      <button
        onClick={handleToggle}
        className={`w-full py-2.5 text-sm font-medium rounded-md transition-colors ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
      >
        {isRecording ? 'Stop & Save' : 'Start Recording'}
      </button>

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Recording actions...
        </div>
      )}

      {/* Compiled result */}
      {compiled && (
        <div className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
          <div className="text-sm font-medium text-gray-800">{compiled.name}</div>
          <div className="text-xs text-gray-500">{compiled.stepCount} steps recorded</div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Recipe'}
          </button>
        </div>
      )}
    </div>
  )
}
