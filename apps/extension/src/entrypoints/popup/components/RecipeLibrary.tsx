import { useRef, useState } from 'react'
import { useQuokkaStore } from '../../../store'
import * as api from '../../../lib/api'
import { downloadRecipe, downloadAllRecipes } from '../../../lib/export-recipe'
import { parseRecipeFile, type ImportPreview } from '../../../lib/import-recipe'
import { copyRecipeJson } from '../../../lib/share-link'
import ImportPreviewDialog from './ImportPreviewDialog'

export default function RecipeLibrary() {
  const recipes = useQuokkaStore((s) => s.recipes)
  const startRun = useQuokkaStore((s) => s.startRun)
  const fetchRecipes = useQuokkaStore((s) => s.fetchRecipes)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importPreviews, setImportPreviews] = useState<ImportPreview[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleExport = async (id: string) => {
    try {
      const exported = await api.exportRecipe(id)
      const recipe = exported.recipe
      const safeName = recipe.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      const json = JSON.stringify(exported, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeName}.quokka.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // silently fail for individual export
    }
  }

  const handleExportAll = async () => {
    try {
      const allExports = await api.exportAllRecipes()
      const json = JSON.stringify(allExports, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'recipes-all.quokka.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // silently fail
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null)
    setImportPreviews(null)
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const result = parseRecipeFile(text)
      const previews = Array.isArray(result) ? result : [result]
      setImportPreviews(previews)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    }
    // Reset input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleConfirmImport = async () => {
    if (!importPreviews) return
    setImporting(true)
    setImportError(null)
    try {
      for (const preview of importPreviews) {
        await api.importRecipe(preview.recipe)
      }
      await fetchRecipes()
      setImportPreviews(null)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleCancelImport = () => {
    setImportPreviews(null)
  }

  const handleShare = async (recipe: typeof recipes[0]) => {
    try {
      await copyRecipeJson(recipe)
      setCopiedId(recipe.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Clipboard API may not be available
    }
  }

  return (
    <div className="space-y-2">
      {importPreviews && (
        <ImportPreviewDialog
          previews={importPreviews}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
          importing={importing}
        />
      )}

      <div className="flex gap-2 mb-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".quokka.json,.json"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
        >
          Import Recipe
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
                onClick={() => handleShare(recipe)}
                className="px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                title="Copy recipe JSON to clipboard"
              >
                {copiedId === recipe.id ? 'Copied!' : 'Share'}
              </button>
              <button
                onClick={() => handleExport(recipe.id)}
                className="px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                title="Download as .quokka.json"
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
