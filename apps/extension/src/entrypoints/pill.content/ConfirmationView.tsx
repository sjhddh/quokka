import { useState } from 'react'
import type { RecordingStep } from './RecordingView'

interface ConfirmationViewProps {
  steps: RecordingStep[]
  recipeName: string
  onConfirm: (name: string, steps: RecordingStep[]) => void
  onDiscard: () => void
}

export default function ConfirmationView({
  steps,
  recipeName,
  onConfirm,
  onDiscard,
}: ConfirmationViewProps) {
  const [name, setName] = useState(recipeName)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [localSteps, setLocalSteps] = useState<RecordingStep[]>(steps)

  function handleStepEdit(id: string, newIntent: string) {
    setLocalSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, intent: newIntent, editing: false } : s))
    )
    setEditingStepId(null)
  }

  function handleStartEdit(id: string) {
    setEditingStepId(id)
    setLocalSteps((prev) => prev.map((s) => ({ ...s, editing: s.id === id })))
  }

  const actionSteps = localSteps.filter((s) => s.type === 'action')

  return (
    <div className="confirmation-view">
      {/* Header */}
      <div className="confirmation-header">
        <span className="confirmation-title">I understood:</span>
        <span className="confirmation-count">{actionSteps.length} step{actionSteps.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Recipe name field */}
      <div className="confirmation-name-row">
        <label className="confirmation-name-label">Name</label>
        <input
          className="confirmation-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Recipe name..."
          maxLength={80}
        />
      </div>

      {/* Step list */}
      <div className="confirmation-step-list">
        {localSteps.map((step, i) => {
          if (step.type === 'page_boundary') {
            return (
              <div key={step.id} className="page-boundary-marker">
                <span className="page-boundary-line" />
                <span className="page-boundary-label">Page load</span>
                <span className="page-boundary-line" />
              </div>
            )
          }

          const actionStepNumber = localSteps
            .slice(0, i + 1)
            .filter((s) => s.type === 'action').length

          return (
            <div
              key={step.id}
              className={`recording-step confirmation-step${step.editing ? ' recording-step-editing' : ''}`}
            >
              <span className="recording-step-num">{actionStepNumber}</span>
              <div className="recording-step-body">
                {step.editing ? (
                  <input
                    className="recording-step-edit"
                    defaultValue={step.intent}
                    autoFocus
                    onBlur={(e) => handleStepEdit(step.id, e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleStepEdit(step.id, e.currentTarget.value)
                        e.currentTarget.blur()
                      }
                      if (e.key === 'Escape') {
                        setEditingStepId(null)
                        setLocalSteps((prev) =>
                          prev.map((s) => ({ ...s, editing: false }))
                        )
                        e.currentTarget.blur()
                      }
                    }}
                  />
                ) : (
                  <span className="recording-step-intent">{step.intent}</span>
                )}
              </div>
              {!step.editing && (
                <button
                  className="recording-step-pencil"
                  onClick={() => handleStartEdit(step.id)}
                  title="Edit intent"
                  aria-label="Edit step"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="confirmation-actions">
        <button
          className="btn btn-confirm"
          onClick={() => onConfirm(name.trim() || 'Untitled recipe', localSteps)}
          disabled={!name.trim()}
        >
          Save
        </button>
        <button className="btn btn-discard" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  )
}
