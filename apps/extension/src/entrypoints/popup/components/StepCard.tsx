import { useState } from 'react'
import type { Step } from '@quokka/shared'

const STEP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  click: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  type: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  navigate: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  wait: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  extract: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  checkpoint: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  scroll: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  select: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  hover: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
}

const STEP_ICONS: Record<string, string> = {
  click: '\u{1F5B1}',
  type: '\u2328',
  navigate: '\u{1F310}',
  wait: '\u23F3',
  extract: '\u{1F4CB}',
  checkpoint: '\u26D4',
  scroll: '\u2195',
  select: '\u{1F4DD}',
  hover: '\u{1F441}',
}

function getStepSummary(step: Step): string {
  if (step.description) return step.description
  switch (step.type) {
    case 'navigate':
      return step.url
    case 'click':
    case 'wait':
    case 'extract':
    case 'scroll':
    case 'hover':
      return step.target.css || step.target.text || step.target.ariaLabel || step.type
    case 'type':
    case 'select':
      return `${step.target.css || step.target.text || ''} = ${step.value}`
    case 'checkpoint':
      return step.message
  }
}

function getSelector(step: Step): string {
  if ('target' in step && step.target) {
    return step.target.css || step.target.text || step.target.ariaLabel || step.target.testId || ''
  }
  return ''
}

interface StepCardProps {
  step: Step
  index: number
  onUpdate: (updated: Step) => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  isDragOver: boolean
}

export default function StepCard({
  step,
  index,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: StepCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const colors = STEP_COLORS[step.type] || STEP_COLORS.click
  const icon = STEP_ICONS[step.type] || '\u2753'

  const handleFieldChange = (field: string, value: string) => {
    const updated = { ...step } as any
    if (field === 'description') {
      updated.description = value
    } else if (field === 'url' && step.type === 'navigate') {
      updated.url = value
    } else if (field === 'value' && ('value' in step)) {
      updated.value = value
    } else if (field === 'selector' && 'target' in step) {
      updated.target = { ...step.target, css: value }
    } else if (field === 'message' && step.type === 'checkpoint') {
      updated.message = value
    }
    onUpdate(updated as Step)
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`border rounded-md transition-all ${
        isDragOver ? 'border-indigo-400 bg-indigo-50/50 shadow-md' : `${colors.border} bg-white`
      }`}
    >
      {/* Compact view */}
      <div className="flex items-center gap-2 px-2 py-2">
        {/* Drag handle */}
        <div className="cursor-grab text-gray-300 hover:text-gray-500 select-none text-xs leading-none" title="Drag to reorder">
          &#x2630;
        </div>

        {/* Step number */}
        <span className="text-[10px] font-mono text-gray-400 w-4 text-right shrink-0">
          {index + 1}
        </span>

        {/* Type badge */}
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${colors.bg} ${colors.text}`}>
          <span>{icon}</span>
          {step.type}
        </span>

        {/* Description */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left text-xs text-gray-700 truncate hover:text-gray-900"
          title="Click to expand/collapse"
        >
          {getStepSummary(step)}
        </button>

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { onDelete(); setConfirmDelete(false) }}
              className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
            title="Delete step"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded edit view */}
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-2">
          <EditField
            label="Description"
            value={step.description || ''}
            onChange={(v) => handleFieldChange('description', v)}
          />
          {step.type === 'navigate' && (
            <EditField
              label="URL"
              value={step.url}
              onChange={(v) => handleFieldChange('url', v)}
            />
          )}
          {'target' in step && (
            <EditField
              label="Selector"
              value={getSelector(step)}
              onChange={(v) => handleFieldChange('selector', v)}
            />
          )}
          {('value' in step) && (
            <EditField
              label="Value"
              value={(step as any).value || ''}
              onChange={(v) => handleFieldChange('value', v)}
            />
          )}
          {step.type === 'checkpoint' && (
            <EditField
              label="Message"
              value={step.message}
              onChange={(v) => handleFieldChange('message', v)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
      />
    </label>
  )
}
