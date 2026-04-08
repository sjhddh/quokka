import type { Step, Locator } from '@quokka/shared'
import type { BrowserBridge } from './bridge.js'

export interface StepResult {
  success: boolean
  data?: string
  error?: string
}

function resolveLocator(locator: Locator): string {
  if (locator.css) return locator.css
  if (locator.testId) return `[data-testid="${locator.testId}"]`
  if (locator.ariaLabel) return `[aria-label="${locator.ariaLabel}"]`
  if (locator.text) return `:has-text("${locator.text}")`
  throw new Error('No valid locator strategy found')
}

function interpolate(value: string, slotValues: Record<string, string>): string {
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in slotValues) return slotValues[key]
    return `{{${key}}}`
  })
}

export class StepExecutor {
  constructor(private bridge: BrowserBridge) {}

  async executeStep(step: Step, slotValues: Record<string, string>): Promise<StepResult> {
    try {
      switch (step.type) {
        case 'click': {
          const selector = resolveLocator(step.target)
          await this.bridge.click(selector)
          return { success: true }
        }
        case 'type': {
          const selector = resolveLocator(step.target)
          const value = interpolate(step.value, slotValues)
          await this.bridge.type(selector, value)
          return { success: true }
        }
        case 'navigate': {
          const url = interpolate(step.url, slotValues)
          await this.bridge.navigate(url)
          return { success: true }
        }
        case 'extract': {
          const selector = resolveLocator(step.target)
          const data = await this.bridge.extract(selector)
          return { success: true, data }
        }
        case 'wait': {
          const selector = resolveLocator(step.target)
          await this.bridge.waitFor(selector, step.timeout)
          return { success: true }
        }
        case 'checkpoint': {
          // Checkpoint steps are handled by the runner, not the executor
          return { success: true }
        }
        default:
          return { success: false, error: `Unknown step type` }
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
