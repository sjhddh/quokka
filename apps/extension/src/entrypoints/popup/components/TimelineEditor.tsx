import { useState, useCallback } from 'react'
import type { Recipe, Step } from '@quokka/shared'
import { reorderSteps, deleteStep, updateStep } from '../../../lib/timeline-helpers'
import StepCard from './StepCard'

interface TimelineEditorProps {
  recipe: Recipe
  onSave: (updatedRecipe: Recipe) => void
  onClose: () => void
}

export default function TimelineEditor({ recipe, onSave, onClose }: TimelineEditorProps) {
  const [steps, setSteps] = useState<Step[]>(recipe.steps)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const hasChanges = JSON.stringify(steps) !== JSON.stringify(recipe.steps)

  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleDragOver = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback((toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const fromIndex = dragIndex
    setDragIndex(null)
    setDragOverIndex(null)
    if (fromIndex === null) return
    setSteps((prev) => reorderSteps(prev, fromIndex, toIndex))
  }, [dragIndex])

  const handleDelete = useCallback((index: number) => {
    setSteps((prev) => deleteStep(prev, index))
  }, [])

  const handleUpdate = useCallback((index: number, updated: Step) => {
    setSteps((prev) => updateStep(prev, index, updated))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updatedRecipe: Recipe = {
        ...recipe,
        steps,
        updatedAt: new Date().toISOString(),
      }
      await onSave(updatedRecipe)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-2">
      <div className="bg-gray-50 rounded-lg shadow-xl w-[380px] max-h-[560px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate">{recipe.name}</h2>
            <p className="text-[10px] opacity-70">{steps.length} step{steps.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white ml-2 shrink-0"
            title="Close editor"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Steps timeline */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {steps.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              No steps. This recipe is empty.
            </div>
          ) : (
            steps.map((step, index) => (
              <div key={`${index}-${step.type}`} className="relative">
                {/* Timeline connector */}
                {index > 0 && (
                  <div className="absolute left-[22px] -top-1.5 w-px h-1.5 bg-gray-200" />
                )}
                <StepCard
                  step={step}
                  index={index}
                  onUpdate={(updated) => handleUpdate(index, updated)}
                  onDelete={() => handleDelete(index)}
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                  isDragOver={dragOverIndex === index && dragIndex !== index}
                />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-between bg-white shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-colors ${
              hasChanges && !saving
                ? 'text-white bg-indigo-600 hover:bg-indigo-700'
                : 'text-gray-400 bg-gray-100 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
