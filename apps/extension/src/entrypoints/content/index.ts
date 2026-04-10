import { ContentBridge } from './bridge'
import { WatchRecorder } from './recorder'
import { FailureOverlay } from './failure-overlay'
import { LinkDetector } from './link-detector'
import { MessageType, type BridgeCallPayload, type ExecuteStepPayload, type ShowFailureOverlayPayload, type StepPauseResponsePayload, type CheckSelectorPayload, type CheckSelectorResult } from '../../lib/messaging'
import { executeStepCommand } from '../../runtime/content-executor'

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const bridge = new ContentBridge()
    const recorder = new WatchRecorder()
    const failureOverlay = new FailureOverlay()
    const linkDetector = new LinkDetector()

    // Start scanning for .quokka.json links on the page
    linkDetector.start()

    // Broadcast recording events to the pill via custom DOM events
    function notifyPill(detail: Record<string, unknown>) {
      window.dispatchEvent(
        new CustomEvent('quokka-pill-event', { detail })
      )
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const { type, payload } = message

      switch (type) {
        case MessageType.BRIDGE_CALL: {
          const call = payload as BridgeCallPayload
          const execute = async () => {
            switch (call.method) {
              case 'click':
                return bridge.click(call.selector!)
              case 'type':
                return bridge.type(call.selector!, call.value!)
              case 'navigate':
                return bridge.navigate(call.url!)
              case 'extract':
                return bridge.extract(call.selector!)
              case 'waitFor':
                return bridge.waitFor(call.selector!, call.timeout)
            }
          }
          execute()
            .then((result) => sendResponse({ ok: true, result }))
            .catch((err) => sendResponse({ ok: false, error: String(err) }))
          return true // async response
        }

        case MessageType.START_WATCH: {
          recorder.start((entry) => {
            // Notify pill of each recorded step
            notifyPill({
              type: 'recording-step',
              entry,
              stepCount: recorder.getEntryCount(),
            })
          })
          notifyPill({ type: 'recording-started' })
          sendResponse({ ok: true })
          return false
        }

        case MessageType.STOP_WATCH: {
          const trace = recorder.stop()
          notifyPill({ type: 'recording-stopped', stepCount: trace.entries.length })
          sendResponse(trace)
          return false
        }

        case MessageType.EXECUTE_STEP: {
          const cmd = payload as ExecuteStepPayload
          executeStepCommand(cmd)
            .then((result) => sendResponse(result))
            .catch((err) => sendResponse({ ok: false, error: String(err) }))
          return true // async response
        }

        case MessageType.RUN_PROGRESS: {
          notifyPill({
            type: 'run-progress',
            currentStep: (payload as Record<string, unknown>).currentStep,
            totalSteps: (payload as Record<string, unknown>).totalSteps,
            status: (payload as Record<string, unknown>).status,
          })
          sendResponse({ ok: true })
          return false
        }

        case MessageType.SHOW_FAILURE_OVERLAY: {
          const overlayPayload = payload as ShowFailureOverlayPayload
          failureOverlay.show(overlayPayload.selector, overlayPayload.error, (action) => {
            chrome.runtime.sendMessage({
              type: MessageType.STEP_PAUSE_RESPONSE,
              payload: {
                runId: '',
                action,
              } satisfies StepPauseResponsePayload,
            })
          })
          sendResponse({ ok: true })
          return false
        }

        case MessageType.HIDE_FAILURE_OVERLAY: {
          failureOverlay.hide()
          sendResponse({ ok: true })
          return false
        }

        case MessageType.CHECK_SELECTOR: {
          const { selector, fallbacks } = payload as CheckSelectorPayload
          const result: CheckSelectorResult = { found: false, count: 0 }

          // Try primary selector
          try {
            const matches = document.querySelectorAll(selector)
            if (matches.length > 0) {
              result.found = true
              result.count = matches.length
              result.matchedVia = selector
              sendResponse(result)
              return false
            }
          } catch {
            // Invalid selector — continue to fallbacks
          }

          // Try fallback selectors
          if (fallbacks) {
            for (const fb of fallbacks) {
              // Skip XPath and pseudo-selectors that querySelector can't handle
              if (fb.startsWith('/') || fb.includes(':has-text(')) continue
              try {
                const matches = document.querySelectorAll(fb)
                if (matches.length > 0) {
                  result.found = true
                  result.count = matches.length
                  result.matchedVia = fb
                  sendResponse(result)
                  return false
                }
              } catch {
                // Invalid selector — skip
              }
            }
          }

          sendResponse(result)
          return false
        }
      }
    })
  },
})
