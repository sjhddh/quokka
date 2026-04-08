import { useRef, useState } from 'react'
import { useQuokkaStore } from '../../../store'
import * as api from '../../../lib/api'

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function RecipeLibrary() {
  const recipes = useQuokkaStore((s) => s.recipes)
  const startRun = useQuokkaStore((s) => s.startRun)
  const fetchRecipes = useQuokkaStore((s) => s.fetchRecipes)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const handleExport = async (id: string) => {
    try {
      const recipe = await api.exportRecipe(id)
      const safeName = recipe.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      downloadJson(recipe, `recipe-${safeName}.json`)
    } catch {
      // silently fail for individual export
    }
  }

  const handleExportAll = async () => {
    try {
      const allRecipes = await api.exportAllRecipes()
      downloadJson(allRecipes, 'recipes-all.json')
    } catch {
      // silently fail
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null)
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await api.importRecipe(data)
      await fetchRecipes()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    }
    // Reset input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
        >
          Import
        </button>
        <button
          onClick={handleExportAll}
          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
        >
          Export All
        </button>
      </div>

      {importError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {importError}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          No recipes yet. Record one with Watch Me or create one in the companion app.
        </div>
      ) : (
        recipes.map((recipe) => (
          <div
            key={recipe.id}
            className="bg-white border border-gray-200 rounded-md p-3 flex items-start justify-between gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{recipe.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {recipe.steps.length} step{recipe.steps.length !== 1 ? 's' : ''}
              </div>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {recipe.hosts.map((host) => (
                  <span
                    key={host}
                    className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded"
                  >
                    {host}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => handleExport(recipe.id)}
                className="px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                title="Export recipe"
              >
                Export
              </button>
              <button
                onClick={() => startRun(recipe.id, {})}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
              >
                Run
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
