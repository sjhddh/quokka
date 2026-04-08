import { MessageType, type StartRunPayload } from '../../lib/messaging'
import * as api from '../../lib/api'

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { type, payload } = message

    switch (type) {
      case MessageType.START_RUN: {
        const { recipeId, slotValues } = payload as StartRunPayload
        handleStartRun(recipeId, slotValues)
          .then((result) => sendResponse({ ok: true, result }))
          .catch((err) => sendResponse({ ok: false, error: String(err) }))
        return true
      }

      case MessageType.RESUME_CHECKPOINT: {
        // Forward approval -- in a full implementation this would
        // signal the running orchestration loop
        sendResponse({ ok: true })
        return false
      }

      case MessageType.COMPILE_TRACE: {
        api
          .compileTrace(payload as api.CompileTracePayload)
          .then((recipe) =>
            sendResponse({ name: recipe.name, stepCount: recipe.steps.length })
          )
          .catch((err) => sendResponse({ ok: false, error: String(err) }))
        return true
      }
    }
  })
})

async function handleStartRun(
  recipeId: string,
  slotValues: Record<string, string>
): Promise<void> {
  const recipe = await api.getRecipe(recipeId)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('No active tab')

  for (let i = 0; i < recipe.steps.length; i++) {
    const step = recipe.steps[i]

    // Resolve slot templates in values
    const resolve = (val: string): string =>
      val.replace(/\{\{(\w+)\}\}/g, (_, key) => slotValues[key] ?? '')

    switch (step.type) {
      case 'click': {
        const selector = step.target.css ?? step.target.testId
          ? step.target.testId
            ? `[data-testid="${step.target.testId}"]`
            : step.target.css!
          : step.target.ariaLabel
            ? `[aria-label="${step.target.ariaLabel}"]`
            : ''
        await chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BRIDGE_CALL,
          payload: { method: 'click', selector },
        })
        break
      }

      case 'type': {
        const selector = step.target.css ?? (step.target.testId
          ? `[data-testid="${step.target.testId}"]`
          : '')
        await chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BRIDGE_CALL,
          payload: { method: 'type', selector, value: resolve(step.value) },
        })
        break
      }

      case 'navigate': {
        await chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BRIDGE_CALL,
          payload: { method: 'navigate', url: resolve(step.url) },
        })
        // Wait for navigation
        await new Promise((r) => setTimeout(r, 1000))
        break
      }

      case 'extract': {
        const selector = step.target.css ?? (step.target.testId
          ? `[data-testid="${step.target.testId}"]`
          : '')
        await chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BRIDGE_CALL,
          payload: { method: 'extract', selector },
        })
        break
      }

      case 'wait': {
        const selector = step.target.css ?? (step.target.testId
          ? `[data-testid="${step.target.testId}"]`
          : '')
        await chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BRIDGE_CALL,
          payload: { method: 'waitFor', selector, timeout: step.timeout },
        })
        break
      }

      case 'checkpoint': {
        // In a full implementation, pause and wait for user approval
        break
      }
    }
  }
}
