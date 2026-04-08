import { useState, useEffect } from 'react'
import { useQuokkaStore } from '../../../store'
import type { ProviderConfig } from '../../../lib/api'

interface ProviderSettingsProps {
  onClose: () => void
}

export default function ProviderSettings({ onClose }: ProviderSettingsProps) {
  const providers = useQuokkaStore((s) => s.providers)
  const fetchProviders = useQuokkaStore((s) => s.fetchProviders)
  const saveProvider = useQuokkaStore((s) => s.saveProvider)
  const removeProvider = useQuokkaStore((s) => s.removeProvider)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [type] = useState<ProviderConfig['type']>('openai-compatible')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const resetForm = () => {
    setName('')
    setApiKey('')
    setBaseUrl('')
    setModel('')
    setError(null)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveProvider({
        id: crypto.randomUUID(),
        name: name.trim(),
        type,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        model: model || undefined,
      })
      resetForm()
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await removeProvider(id)
    } catch {
      // silently fail
    }
  }

  return (
    <div className="absolute inset-0 bg-gray-50 z-10 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">Provider Settings</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Close settings"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Provider list */}
        {providers.length === 0 && !showForm && (
          <div className="text-center py-6 text-sm text-gray-400">
            No providers configured. Add one to enable AI recipe generation.
          </div>
        )}

        {providers.map((p) => (
          <div
            key={p.id}
            className="bg-white border border-gray-200 rounded-md p-3 flex items-start justify-between gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {p.type} {p.model ? `/ ${p.model}` : ''}
              </div>
              {p.baseUrl && (
                <div className="text-[10px] text-gray-400 mt-0.5 truncate">{p.baseUrl}</div>
              )}
            </div>
            <button
              onClick={() => handleDelete(p.id)}
              className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors shrink-0"
            >
              Delete
            </button>
          </div>
        ))}

        {/* Add provider form */}
        {showForm ? (
          <div className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
            <div className="text-xs font-medium text-gray-700 mb-1">Add Provider</div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Provider name"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="text-xs text-gray-500 px-1">Type: openai-compatible</div>

            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API Key"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-mini"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
          >
            + Add Provider
          </button>
        )}
      </div>
    </div>
  )
}
