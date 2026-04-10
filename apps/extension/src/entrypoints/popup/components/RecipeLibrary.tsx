import { useRef, useState, useEffect, useCallback } from 'react'
import type { Recipe } from '@quokka/shared'
import { useQuokkaStore } from '../../../store'
import * as api from '../../../lib/api'
import { downloadRecipe, downloadAllRecipes } from '../../../lib/export-recipe'
import { parseRecipeFile, type ImportPreview } from '../../../lib/import-recipe'
import { copyRecipeJson, copyShareUrl } from '../../../lib/share-link'
import ImportPreviewDialog from './ImportPreviewDialog'
import TimelineEditor from './TimelineEditor'
import { incrementStat } from '../../../lib/stats'
import { checkRecipeHealth, type HealthReport, type StepHealth } from '../../../runtime/health-check'
import {
  scheduleRecipe,
  unscheduleRecipe,
  getScheduledRecipes,
  type ScheduleInterval,
  type ScheduledRecipe,
} from '../../../lib/scheduler'

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
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const updateRecipe = useQuokkaStore((s) => s.updateRecipe)

  const [healthReports, setHealthReports] = useState<Record<string, HealthReport>>({})
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null)
  const [expandedHealth, setExpandedHealth] = useState<string | null>(null)

  const [schedules, setSchedules] = useState<Record<string, ScheduledRecipe>>({})
  const [scheduleMenuId, setScheduleMenuId] = useState<string | null>(null)

  // Load scheduled recipes on mount
  useEffect(() => {
    getScheduledRecipes().then((list) => {
      const map: Record<string, ScheduledRecipe> = {}
      for (const s of list) map[s.recipeId] = s
      setSchedules(map)
    })
  }, [])

  const handleSchedule = useCallback(async (recipeId: string, interval: ScheduleInterval | 'off') => {
    if (interval === 'off') {
      await unscheduleRecipe(recipeId)
      setSchedules((prev) => {
        const next = { ...prev }
        delete next[recipeId]
        return next
      })
    } else {
      await scheduleRecipe(recipeId, interval)
      setSchedules((prev) => ({
        ...prev,
        [recipeId]: { recipeId, interval, slotValues: {}, createdAt: new Date().toISOString() },
      }))
    }
    setScheduleMenuId(null)
  }, [])

  // Load cached health reports from chrome.storage on mount
  useEffect(() => {
    chrome.storage.local.get('healthReports', (result) => {
      if (result.healthReports) {
        setHealthReports(result.healthReports as Record<string, HealthReport>)
      }
    })
  }, [])

  const handleHealthCheck = useCallback(async (recipe: Recipe) => {
    setCheckingHealth(recipe.id)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        setCheckingHealth(null)
        return
      }
      const report = await checkRecipeHealth(recipe, tab.id)
      setHealthReports((prev) => {
        const updated = { ...prev, [recipe.id]: report }
        chrome.storage.local.set({ healthReports: updated })
        return updated
      })
      setExpandedHealth(recipe.id)
    } catch {
      // Health check failed — ignore silently
    } finally {
      setCheckingHealth(null)
    }
  }, [])

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

  const handleShareLink = async (recipe: typeof recipes[0]) => {
    try {
      const wasUrl = await copyShareUrl(recipe)
      setLinkCopiedId(recipe.id)
      setTimeout(() => setLinkCopiedId(null), 2000)
      if (!wasUrl) {
        // Recipe too large for URL, fell back to JSON copy
        setCopiedId(recipe.id)
        setTimeout(() => setCopiedId(null), 2000)
      }
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
              <div className="flex items-center gap-1.5">
                {healthReports[recipe.id] && (
                  <span
                    className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                      healthReports[recipe.id].overallStatus === 'healthy'
                        ? 'bg-green-500'
                        : healthReports[recipe.id].overallStatus === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                    title={`Health: ${healthReports[recipe.id].overallStatus}`}
                  />
                )}
                <div className="text-sm font-medium text-gray-800 truncate">{recipe.name}</div>
              </div>
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
              <div className="relative">
                <button
                  onClick={() => setScheduleMenuId(scheduleMenuId === recipe.id ? null : recipe.id)}
                  className={`px-2 py-1.5 text-xs font-medium border rounded transition-colors ${
                    schedules[recipe.id]
                      ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                      : 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  title={schedules[recipe.id] ? `Scheduled: ${schedules[recipe.id].interval}` : 'Schedule recipe'}
                >
                  {schedules[recipe.id] ? `\u23F0 ${schedules[recipe.id].interval}` : '\u23F0'}
                </button>
                {scheduleMenuId === recipe.id && (
                  <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[120px]">
                    {(['hourly', 'daily', 'weekly'] as const).map((interval) => (
                      <button
                        key={interval}
                        onClick={() => handleSchedule(recipe.id, interval)}
                        className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                          schedules[recipe.id]?.interval === interval ? 'text-indigo-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        {interval.charAt(0).toUpperCase() + interval.slice(1)}
                      </button>
                    ))}
                    {schedules[recipe.id] && (
                      <button
                        onClick={() => handleSchedule(recipe.id, 'off')}
                        className="block w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border-t border-gray-100"
                      >
                        Turn off
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleHealthCheck(recipe)}
                disabled={checkingHealth === recipe.id}
                className="px-2 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors disabled:opacity-50"
                title="Check recipe health against current page"
              >
                {checkingHealth === recipe.id ? '...' : 'Check'}
              </button>
              <button
                onClick={() => setEditingRecipe(recipe)}
                className="px-2 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
                title="Edit recipe steps"
              >
                Edit
              </button>
              <button
                onClick={() => handleShareLink(recipe)}
                className="px-2 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
                title="Copy shareable link to clipboard"
              >
                {linkCopiedId === recipe.id ? 'Link copied!' : 'Share link'}
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
            {expandedHealth === recipe.id && healthReports[recipe.id] && (
              <HealthReportPanel
                report={healthReports[recipe.id]}
                onClose={() => setExpandedHealth(null)}
              />
            )}
          </div>
        ))
      )}
    </div>
  )
}

function HealthReportPanel({
  report,
  onClose,
}: {
  report: HealthReport
  onClose: () => void
}) {
  const okCount = report.steps.filter((s) => s.status === 'ok').length
  const total = report.steps.length

  return (
    <div className="w-full mt-2 border-t border-gray-100 pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-700">
          {okCount}/{total} steps healthy
        </span>
        <button
          onClick={onClose}
          className="text-[10px] text-gray-400 hover:text-gray-600"
        >
          Hide
        </button>
      </div>
      <div className="space-y-1">
        {report.steps.map((step) => (
          <HealthStepRow key={step.index} step={step} />
        ))}
      </div>
    </div>
  )
}

function HealthStepRow({ step }: { step: StepHealth }) {
  const [expanded, setExpanded] = useState(false)
  const icon =
    step.status === 'ok'
      ? 'text-green-500'
      : step.status === 'warning'
        ? 'text-yellow-500'
        : 'text-red-500'
  const symbol =
    step.status === 'ok' ? '\u2713' : step.status === 'warning' ? '!' : '\u2717'

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left text-[11px] hover:bg-gray-50 rounded px-1 py-0.5"
      >
        <span className={`font-bold ${icon}`}>{symbol}</span>
        <span className="text-gray-500">#{step.index + 1}</span>
        <span className="text-gray-700">{step.type}</span>
        {step.status === 'not-found' && (
          <span className="text-red-400 truncate ml-auto">{step.selector}</span>
        )}
      </button>
      {expanded && (
        <div className="ml-6 text-[10px] text-gray-500 pb-1">
          {step.message}
          {step.selector && (
            <div className="font-mono text-gray-400 truncate">{step.selector}</div>
          )}
        </div>
      )}
    </div>
  )
}
