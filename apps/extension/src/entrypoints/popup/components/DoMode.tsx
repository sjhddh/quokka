import { useState, useEffect } from 'react'
import { useQuokkaStore } from '../../../store'
import * as api from '../../../lib/api'

export default function DoMode() {
  const [prompt, setPrompt] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [stepsExpanded, setStepsExpanded] = useState(false)

  const generatingRecipe = useQuokkaStore((s) => s.generatingRecipe)
  const generatedRecipe = useQuokkaStore((s) => s.generatedRecipe)
  const generateError = useQuokkaStore((s) => s.generateError)
  const generateRecipe = useQuokkaStore((s) => s.generateRecipe)
  const clearGeneratedRecipe = useQuokkaStore((s) => s.clearGeneratedRecipe)
  const providers = useQuokkaStore((s) => s.providers)
  const fetchProviders = useQuokkaStore((s) => s.fetchProviders)
  const startRun = useQuokkaStore((s) => s.startRun)
  const fetchRecipes = useQuokkaStore((s) => s.fetchRecipes)

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    await generateRecipe(prompt.trim(), selectedProvider || undefined)
  }

  const handleSave = async () => {
    if (!generatedRecipe) return
    try {
      await api.createRecipe({
        name: generatedRecipe.name,
        description: generatedRecipe.description,
        version: generatedRecipe.version,
        hosts: generatedRecipe.hosts,
        slots: generatedRecipe.slots,
        guards: generatedRecipe.guards,
        steps: generatedRecipe.steps,
        meta: generatedRecipe.meta,
      })
      await fetchRecipes()
      clearGeneratedRecipe()
      setPrompt('')
    } catch {
      // save error handled silently
    }
  }

  const handleSaveAndRun = async () => {
    if (!generatedRecipe) return
    try {
      const saved = await api.createRecipe({
        name: generatedRecipe.name,
        description: generatedRecipe.description,
        version: generatedRecipe.version,
        hosts: generatedRecipe.hosts,
        slots: generatedRecipe.slots,
        guards: generatedRecipe.guards,
        steps: generatedRecipe.steps,
        meta: generatedRecipe.meta,
      })
      await fetchRecipes()
      clearGeneratedRecipe()
      setPrompt('')
      await startRun(saved.id, {})
    } catch {
      // error handled silently
    }
  }

  const handleDiscard = () => {
    clearGeneratedRecipe()
  }

  const stepLabel = (step: { type: string; target?: unknown; url?: string }) => {
    if (step.type === 'navigate') return step.url ?? ''
    if (step.type === 'checkpoint') return ''
    const target = step.target as { css?: string; text?: string; ariaLabel?: string } | undefined
    if (!target) return ''
    return target.css ?? target.text ?? target.ariaLabel ?? ''
  }

  return (
    <div className="space-y-3">
      {!generatedRecipe && (
        <>
          {/* Prompt input */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Describe your task
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to automate..."
              rows={4}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              disabled={generatingRecipe}
            />
          </div>

          {/* Provider selector */}
          {providers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Provider (optional)
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={generatingRecipe}
              >
                <option value="">Default</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model ?? p.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generatingRecipe}
            className="w-full py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generatingRecipe ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Generating...
              </span>
            ) : (
              'Generate Recipe'
            )}
          </button>

          {/* Error */}
          {generateError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {generateError}
            </div>
          )}
        </>
      )}

      {/* Generated recipe preview */}
      {generatedRecipe && (
        <div className="bg-white border border-gray-200 rounded-md p-3 space-y-3">
          <div>
            <div className="text-sm font-medium text-gray-800">{generatedRecipe.name}</div>
            {generatedRecipe.description && (
              <div className="text-xs text-gray-500 mt-0.5">{generatedRecipe.description}</div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {generatedRecipe.steps.length} step{generatedRecipe.steps.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Collapsible steps */}
          <div>
            <button
              onClick={() => setStepsExpanded(!stepsExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              <span className={`transition-transform ${stepsExpanded ? 'rotate-90' : ''}`}>
                &#9654;
              </span>
              {stepsExpanded ? 'Hide steps' : 'Show steps'}
            </button>
            {stepsExpanded && (
              <div className="mt-2 space-y-1">
                {generatedRecipe.steps.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs text-gray-600 py-1 border-b border-gray-100 last:border-0"
                  >
                    <span className="shrink-0 w-5 text-right text-gray-400">{i + 1}.</span>
                    <span className="font-medium text-indigo-600 shrink-0">{step.type}</span>
                    <span className="text-gray-500 truncate">{stepLabel(step)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSaveAndRun}
              className="flex-1 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Save & Run
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleDiscard}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
