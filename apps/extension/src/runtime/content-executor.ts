import type { Locator } from '@quokka/shared'
import { findElement, waitForElement, interpolate } from './selector-utils'

export interface StepCommand {
  type: 'click' | 'type' | 'navigate' | 'extract' | 'wait' | 'check_selector'
  locator?: Locator
  value?: string
  url?: string
  timeout?: number
  slotValues?: Record<string, string>
}

export interface StepResult {
  ok: boolean
  data?: string
  error?: string
}

/**
 * Execute a single step command in the content script context.
 * This runs on the actual page DOM — no companion server needed.
 */
export async function executeStepCommand(cmd: StepCommand): Promise<StepResult> {
  const slots = cmd.slotValues ?? {}

  try {
    switch (cmd.type) {
      case 'navigate': {
        const url = interpolate(cmd.url ?? '', slots)
        window.location.href = url
        return { ok: true }
      }

      case 'click': {
        if (!cmd.locator) return { ok: false, error: 'No locator for click step' }
        const el = findElement(cmd.locator)
        if (!el) return { ok: false, error: `Element not found: ${JSON.stringify(cmd.locator)}` }
        el.scrollIntoView?.({ block: 'center', behavior: 'instant' })
        el.click()
        return { ok: true }
      }

      case 'type': {
        if (!cmd.locator) return { ok: false, error: 'No locator for type step' }
        const el = findElement(cmd.locator) as HTMLInputElement | HTMLTextAreaElement | null
        if (!el) return { ok: false, error: `Element not found: ${JSON.stringify(cmd.locator)}` }
        const value = interpolate(cmd.value ?? '', slots)

        el.focus()
        // Clear existing value
        el.value = ''
        el.dispatchEvent(new Event('input', { bubbles: true }))

        // Set new value
        el.value = value
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return { ok: true }
      }

      case 'wait': {
        if (!cmd.locator) return { ok: false, error: 'No locator for wait step' }
        await waitForElement(cmd.locator, cmd.timeout ?? 5000)
        return { ok: true }
      }

      case 'extract': {
        if (!cmd.locator) return { ok: false, error: 'No locator for extract step' }
        const el = findElement(cmd.locator)
        if (!el) return { ok: false, error: `Element not found: ${JSON.stringify(cmd.locator)}` }
        const data = el.textContent?.trim() ?? ''
        return { ok: true, data }
      }

      case 'check_selector': {
        if (!cmd.locator) return { ok: false, error: 'No locator for check_selector' }
        const found = findElement(cmd.locator)
        return { ok: true, data: found ? 'true' : 'false' }
      }

      default:
        return { ok: false, error: `Unknown step type: ${cmd.type}` }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
