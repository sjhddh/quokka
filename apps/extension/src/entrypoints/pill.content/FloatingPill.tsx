import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageType, sendToBackground, humanizeStep } from '../../lib/messaging'
import PillSidebar from './PillSidebar'
import StepToast, { useToasts } from './StepToast'

type PillState = 'idle' | 'onboarding' | 'recording' | 'running' | 'error'

function describeEntry(entry: { type: string; selector?: string; value?: string; url?: string }): string {
  // Convert to HumanizeStepInput shape and delegate to humanizeStep
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
        // Position center-right for onboarding visibility
        const centerBottom = Math.round(window.innerHeight / 2 - 28)
        setPosition({ bottom: centerBottom, right: 24 })
      }
    })

    sendToBackground<{ ok: boolean; isRecording: boolean; stepCount: number }>({
      type: MessageType.GET_STATE,
    })
      .then((resp) => {
        if (resp?.isRecording) {
          setState('recording')
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
    let didDrag = false

    function handleMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      didDrag = true
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
        compiled?: { name: string; stepCount: number }
      }>({
        type: MessageType.TOGGLE_RECORDING,
      })
      if (resp?.isRecording) {
        setState('recording')
        setStepCount(0)
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

  const progressPct =
    runProgress.total > 0
      ? Math.round((runProgress.current / runProgress.total) * 100)
      : 0

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

      {/* Sidebar */}
      {sidebarOpen && (
        <PillSidebar
          isRecording={state === 'recording'}
          onToggleRecording={handleToggleRecording}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </>
  )
}
