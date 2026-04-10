import { useRef, useState } from 'react'
import type { Recipe } from '@quokka/shared'
import { useQuokkaStore } from '../../../store'
import * as api from '../../../lib/api'
import { downloadRecipe, downloadAllRecipes } from '../../../lib/export-recipe'
import { parseRecipeFile, type ImportPreview } from '../../../lib/import-recipe'
import { copyRecipeJson } from '../../../lib/share-link'
import ImportPreviewDialog from './ImportPreviewDialog'
import TimelineEditor from './TimelineEditor'
import { incrementStat } from '../../../lib/stats'

export default function RecipeLibrary() {
  const recipes = useQuokkaStore((s) => s.recipes)
  const startRun = useQuokkaStore((s) => s.startRun)
  const fetchRecipes = useQuokkaStore((s) => s.fetchRecipes)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importPreviews, setImportPreviews] = useState<ImportPreview[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const updateRecipe = useQuokkaStore((s) => s.updateRecipe)

  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async (id: string) => {
    setExportError(null)
    try {
      // Try companion export first, fall back to local
      let recipe: typeof recipes[0] | undefined
      try {
        const exported = await api.exportRecipe(id)
        recipe = exported.recipe
      } catch {
        recipe = recipes.find((r) => r.id === id)
      }
      if (!recipe) {
        setExportError('Recipe not found. It may have been deleted.')
        return
      }
      downloadRecipe(recipe)
      await incrementStat('recipesExported')
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export recipe')
    }
  }

  const handleExportAll = async () => {
    setExportError(null)
    try {
      if (recipes.length === 0) {
        setExportError('No recipes to export')
        return
      }
      downloadAllRecipes(recipes)
      for (const _ of recipes) {
        await incrementStat('recipesExported')
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export recipes')
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
        try {
          await api.importRecipe(preview.recipe)
        } catch {
          // Companion unavailable — save directly to local storage
          await import('../../../lib/local-storage').then((ls) =>
            ls.saveRecipe(preview.recipe),
          )
        }
        await incrementStat('recipesImported')
      }
      await fetchRecipes()
      setImportPreviews(null)
      setShowImportDialog(false)
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Failed to save imported recipes to storage.',
      )
    } finally {
      setImporting(false)
    }
  }

  const handleCancelImport = () => {
    setImportPreviews(null)
    setShowImportDialog(false)
    setImportError(null)
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

  const handleOpenImport = () => {
    setImportError(null)
    setImportPreviews(null)
    setShowImportDialog(true)
  }

  return (
    <div className="space-y-2">
      {editingRecipe && (
        <TimelineEditor
          recipe={editingRecipe}
          onSave={async (updated) => {
            await updateRecipe(updated)
            setEditingRecipe(null)
          }}
          onClose={() => setEditingRecipe(null)}
        />
      )}

      {showImportDialog && (
        <ImportPreviewDialog
          previews={importPreviews}
          onParsed={(previews) => setImportPreviews(previews)}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
          importing={importing}
          error={importError}
          fileInput={
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".quokka.json,.json"
                className="hidden"
                onChange={handleFileSelected}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
              >
                Choose File
              </button>
            </>
          }
        />
      )}

      <div className="flex gap-2 mb-2">
        <button
          onClick={handleOpenImport}
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

      {importError && !showImportDialog && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {importError}
        </div>
      )}

      {exportError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {exportError}
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
              {recipe.meta?.description && (
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {recipe.meta.description}
                </div>
              )}
              <div className="flex gap-2 mt-0.5 text-xs text-gray-500">
                {recipe.steps.length > 0 && (
                  <span>
                    {recipe.steps.length} step{recipe.steps.length !== 1 ? 's' : ''}
                  </span>
                )}
                {typeof recipe.meta?.runCount === 'number' && recipe.meta.runCount > 0 && (
                  <span className="text-indigo-500">
                    Ran {recipe.meta.runCount} time{recipe.meta.runCount !== 1 ? 's' : ''}
                  </span>
                )}
                {recipe.meta?.author?.name && (
                  <span>
                    by{' '}
                    {recipe.meta.author.url ? (
                      <a
                        href={recipe.meta.author.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        {recipe.meta.author.name}
                      </a>
                    ) : (
                      recipe.meta.author.name
                    )}
                  </span>
                )}
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
                onClick={() => setEditingRecipe(recipe)}
                className="px-2 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
                title="Edit recipe steps"
              >
                Edit
              </button>
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
