import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageType, sendToBackground, humanizeStep } from '../../lib/messaging'
import PillSidebar from './PillSidebar'
import StepToast, { useToasts } from './StepToast'
import RecordingView, { type RecordingStep } from './RecordingView'
import ConfirmationView from './ConfirmationView'

type PillState = 'idle' | 'onboarding' | 'recording' | 'recording-v2' | 'confirming' | 'running' | 'error'

function describeEntry(entry: { type: string; selector?: string; value?: string; url?: string }): string {
  return humanizeStep({
    type: entry.type,
    target: entry.selector ? { css: entry.selector } : undefined,
    value: entry.value,
    url: entry.url,
  })
}

export default function FloatingPill() {
  const [state, setState] = useState<PillState>('idle')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stepCount, setStepCount] = useState(0)
  const [runProgress, setRunProgress] = useState({ current: 0, total: 0 })
  const { toasts, addToast } = useToasts()

  // v2 recording state
  const [recordingSteps, setRecordingSteps] = useState<RecordingStep[]>([])
  const [recipeName, setRecipeName] = useState('Untitled recipe')

  // Drag state
  const pillRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [position, setPosition] = useState({ bottom: 24, right: 24 })

  // Check onboarding flag & fetch initial state from background
  useEffect(() => {
    chrome.storage.local.get('hasSeenOnboarding', (result) => {
      if (!result.hasSeenOnboarding) {
        setState('onboarding')
        const centerBottom = Math.round(window.innerHeight / 2 - 28)
        setPosition({ bottom: centerBottom, right: 24 })
      }
    })

    sendToBackground<{ ok: boolean; isRecording: boolean; stepCount: number; isV2?: boolean }>({
      type: MessageType.GET_STATE,
    })
      .then((resp) => {
        if (resp?.isRecording) {
          setState(resp.isV2 ? 'recording-v2' : 'recording')
          setStepCount(resp.stepCount)
        }
      })
      .catch(() => {})
  }, [])

  // Listen for recording events from content script via DOM events
  useEffect(() => {
    function handlePillEvent(e: Event) {
      const detail = (e as CustomEvent).detail
      if (!detail) return

      switch (detail.type) {
        case 'recording-started':
          setState('recording')
          setStepCount(0)
          break

        case 'recording-started-v2':
          setState('recording-v2')
          setRecordingSteps([])
          setRecipeName('Untitled recipe')
          break

        case 'recording-stopped':
          setState('idle')
          setStepCount(0)
          break

        case 'recording-step':
          setStepCount(detail.stepCount ?? 0)
          if (detail.entry) {
            addToast(describeEntry(detail.entry))
          }
          break

        // v2: a new action was captured — add a pending step immediately
        case 'action-captured': {
          const stepId: string = detail.stepId
          if (!stepId) break
          const pendingStep: RecordingStep = {
            id: stepId,
            intent: '',
            type: 'action',
            editing: false,
            pending: true,
          }
          setRecordingSteps((prev) => [...prev, pendingStep])
          break
        }

        // v2: LLM finished extracting intent for a step
        case 'intent-extracted': {
          const { stepId, step } = detail
          if (!stepId || !step) break
          if (step.type === 'page_boundary') {
            // Replace or insert as page_boundary
            setRecordingSteps((prev) => {
              const existing = prev.findIndex((s) => s.id === stepId)
              const boundary: RecordingStep = {
                id: stepId,
                intent: '',
                type: 'page_boundary',
                editing: false,
                pending: false,
              }
              if (existing >= 0) {
                const next = [...prev]
                next[existing] = boundary
                return next
              }
              return [...prev, boundary]
            })
          } else {
            // action step — fill in the intent
            setRecordingSteps((prev) => {
              const existing = prev.findIndex((s) => s.id === stepId)
              const resolved: RecordingStep = {
                id: stepId,
                intent: step.intent ?? '',
                type: 'action',
                editing: false,
                pending: false,
              }
              if (existing >= 0) {
                const next = [...prev]
                next[existing] = resolved
                return next
              }
              return [...prev, resolved]
            })
          }
          break
        }

        // v2: background signals recording is complete, show confirmation
        case 'recording-complete-v2': {
          const name: string = detail.recipeName ?? 'Untitled recipe'
          setRecipeName(name)
          setState('confirming')
          break
        }

        case 'run-progress':
          setState(detail.status === 'failed' ? 'error' : 'running')
          setRunProgress({
            current: detail.currentStep ?? 0,
            total: detail.totalSteps ?? 0,
          })
          if (detail.status === 'completed' || detail.status === 'failed') {
            setTimeout(() => setState('idle'), 2000)
          }
          break
      }
    }

    window.addEventListener('quokka-pill-event', handlePillEvent)
    return () => window.removeEventListener('quokka-pill-event', handlePillEvent)
  }, [addToast])

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (sidebarOpen) return
      dragging.current = true
      const pill = pillRef.current
      if (!pill) return
      const rect = pill.getBoundingClientRect()
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
      pill.classList.add('dragging')
      e.preventDefault()
    },
    [sidebarOpen]
  )

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const pill = pillRef.current
      if (!pill) return
      const pw = pill.offsetWidth
      const ph = pill.offsetHeight

      const newRight = Math.max(0, Math.min(vw - pw, vw - e.clientX + dragOffset.current.x - pw / 2))
      const newBottom = Math.max(0, Math.min(vh - ph, vh - e.clientY + dragOffset.current.y - ph / 2))
      setPosition({ right: newRight, bottom: newBottom })
    }

    function handleMouseUp() {
      if (dragging.current) {
        dragging.current = false
        pillRef.current?.classList.remove('dragging')
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const dismissOnboarding = useCallback(() => {
    chrome.storage.local.set({ hasSeenOnboarding: true })
    setState('idle')
    setPosition({ bottom: 24, right: 24 })
  }, [])

  const handleClick = useCallback(() => {
    if (dragging.current) return
    if (state === 'onboarding') {
      dismissOnboarding()
      setSidebarOpen(true)
      return
    }
    setSidebarOpen((prev) => !prev)
  }, [state, dismissOnboarding])

  const handleToggleRecording = useCallback(async () => {
    try {
      const resp = await sendToBackground<{
        ok: boolean
        isRecording: boolean
        isV2?: boolean
        compiled?: { name: string; stepCount: number }
      }>({
        type: MessageType.TOGGLE_RECORDING,
      })
      if (resp?.isRecording) {
        if (resp.isV2) {
          setState('recording-v2')
          setRecordingSteps([])
          setRecipeName('Untitled recipe')
        } else {
          setState('recording')
          setStepCount(0)
        }
      } else {
        setState('idle')
        setStepCount(0)
        if (resp?.compiled) {
          addToast(`Saved: ${resp.compiled.name} (${resp.compiled.stepCount} steps)`)
        }
      }
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2000)
    }
  }, [addToast])

  // v2: user edited an intent inline during recording
  const handleEditStep = useCallback((id: string, newIntent: string) => {
    setRecordingSteps((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        // If newIntent equals current intent, this is a toggle-into-edit-mode call
        if (s.intent === newIntent && !s.editing) {
          return { ...s, editing: true }
        }
        return { ...s, intent: newIntent, editing: false }
      })
    )
  }, [])

  // v2: user clicks Done on recording view — stop recording and go to confirming
  const handleStopRecordingV2 = useCallback(async () => {
    try {
      await sendToBackground({ type: MessageType.TOGGLE_RECORDING })
    } catch {
      // ignore
    }
    setState('confirming')
  }, [])

  // v2: user confirms the recording in ConfirmationView
  const handleConfirm = useCallback(
    async (name: string, steps: RecordingStep[]) => {
      try {
        await sendToBackground({
          type: MessageType.RECORDING_COMPLETE_V2,
          payload: { name, steps },
        })
        addToast(`Saved: ${name} (${steps.filter((s) => s.type === 'action').length} steps)`)
      } catch {
        // ignore
      }
      setState('idle')
      setRecordingSteps([])
    },
    [addToast]
  )

  // v2: user discards recording
  const handleDiscard = useCallback(async () => {
    try {
      // If recording is still active, toggle it off
      await sendToBackground({ type: MessageType.TOGGLE_RECORDING })
    } catch {
      // ignore
    }
    setState('idle')
    setRecordingSteps([])
  }, [])

  const progressPct =
    runProgress.total > 0
      ? Math.round((runProgress.current / runProgress.total) * 100)
      : 0

  // When in v2 recording or confirming states, show panel instead of sidebar
  const showRecordingPanel = state === 'recording-v2'
  const showConfirmPanel = state === 'confirming'

  return (
    <>
      {/* Floating pill */}
      <div
        ref={pillRef}
        className={`pill ${state}`}
        style={{ bottom: `${position.bottom}px`, right: `${position.right}px` }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {state === 'onboarding' ? (
          <>
            <span className="pill-logo onboarding-glow">Q</span>
            <span className="pill-label">
              Record your first automation! Click here to start.
            </span>
            <button
              className="onboarding-dismiss"
              onClick={(e) => {
                e.stopPropagation()
                dismissOnboarding()
              }}
              aria-label="Dismiss onboarding"
            >
              &times;
            </button>
          </>
        ) : state === 'recording' ? (
          <>
            <span className="recording-dot" />
            <span className="pill-label">
              Recording... {stepCount} step{stepCount !== 1 ? 's' : ''}
            </span>
          </>
        ) : state === 'recording-v2' ? (
          <>
            <span className="watching-dot" />
            <span className="pill-label">
              Watching... {recordingSteps.filter((s) => s.type === 'action').length} step{recordingSteps.filter((s) => s.type === 'action').length !== 1 ? 's' : ''}
            </span>
          </>
        ) : state === 'confirming' ? (
          <>
            <span className="pill-logo">Q</span>
            <span className="pill-label">Review recording</span>
          </>
        ) : state === 'running' ? (
          <>
            <span className="pill-logo">Q</span>
            <div className="pill-progress-wrap">
              <div
                className="pill-progress-bar"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="pill-label">
              {runProgress.current}/{runProgress.total}
            </span>
          </>
        ) : (
          <>
            <span className="pill-logo">Q</span>
            <span className="pill-label">Quokka</span>
          </>
        )}
      </div>

      {/* Step toasts */}
      <StepToast toasts={toasts} />

      {/* v2 recording panel */}
      {showRecordingPanel && (
        <RecordingView
          steps={recordingSteps}
          onEditStep={handleEditStep}
          onStopRecording={handleStopRecordingV2}
        />
      )}

      {/* v2 confirmation panel */}
      {showConfirmPanel && (
        <ConfirmationView
          steps={recordingSteps}
          recipeName={recipeName}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
        />
      )}

      {/* Regular sidebar (not shown during v2 recording/confirming) */}
      {sidebarOpen && !showRecordingPanel && !showConfirmPanel && (
        <PillSidebar
          isRecording={state === 'recording'}
          onToggleRecording={handleToggleRecording}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </>
  )
}
