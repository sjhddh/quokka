import { useRef, useEffect } from 'react'

export interface RecordingStep {
  id: string
  intent: string
  type: 'action' | 'page_boundary'
  editing: boolean
  pending: boolean
}

interface RecordingViewProps {
  steps: RecordingStep[]
  onEditStep: (id: string, newIntent: string) => void
  onStopRecording: () => void
}

export default function RecordingView({ steps, onEditStep, onStopRecording }: RecordingViewProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as steps arrive
  useEffect(() => {
    const el = listRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [steps.length])

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === 'Enter') {
      onEditStep(id, e.currentTarget.value)
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      e.currentTarget.blur()
    }
  }

  return (
    <div className="recording-view">
      {/* Header */}
      <div className="recording-view-header">
        <span className="watching-indicator" />
        <span className="recording-view-title">Watching...</span>
        <span className="recording-step-count">{steps.filter((s) => s.type === 'action').length} steps</span>
      </div>

      {/* Step list */}
      <div className="recording-step-list" ref={listRef}>
        {steps.length === 0 ? (
          <div className="recording-empty">
            Perform actions on the page to record them.
          </div>
        ) : (
          steps.map((step, i) => {
            if (step.type === 'page_boundary') {
              return (
                <div key={step.id} className="page-boundary-marker">
                  <span className="page-boundary-line" />
                  <span className="page-boundary-label">Page load</span>
                  <span className="page-boundary-line" />
                </div>
              )
            }

            const actionStepNumber = steps
              .slice(0, i + 1)
              .filter((s) => s.type === 'action').length

            return (
              <div
                key={step.id}
                className={`recording-step${step.pending ? ' recording-step-pending' : ''}${step.editing ? ' recording-step-editing' : ''}`}
              >
                <span className="recording-step-num">{actionStepNumber}</span>
                <div className="recording-step-body">
                  {step.editing ? (
                    <input
                      className="recording-step-edit"
                      defaultValue={step.intent}
                      autoFocus
                      onBlur={(e) => onEditStep(step.id, e.currentTarget.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, step.id)}
                    />
                  ) : step.pending ? (
                    <span className="recording-step-skeleton">Understanding...</span>
                  ) : (
                    <span className="recording-step-intent">{step.intent}</span>
                  )}
                </div>
                {!step.pending && !step.editing && (
                  <button
                    className="recording-step-pencil"
                    onClick={() => onEditStep(step.id, step.intent)}
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
          })
        )}
      </div>

      {/* Done button */}
      <div className="recording-view-footer">
        <button className="btn btn-stop-recording" onClick={onStopRecording}>
          Done
        </button>
      </div>
    </div>
  )
}
