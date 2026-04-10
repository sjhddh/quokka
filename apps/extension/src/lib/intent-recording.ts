/**
 * Intent recording session — manages real-time LLM intent extraction
 * during a v2 recording session.
 *
 * Used by the background service worker. Created when recording starts,
 * discarded when recording stops or if no LLM provider is configured.
 */

import { IntentExtractor, type IntentStep, type PageBoundaryStep } from '@quokka/core'
import { OpenAICompatProvider } from '@quokka/core'
import type { ProviderConfig } from './api'
import type { ActionCapturedPayload } from './messaging'
import type { RecipeV2 } from '@quokka/shared'

export class IntentRecordingSession {
  private steps: (IntentStep | PageBoundaryStep)[] = []
  private extractor: IntentExtractor

  constructor(provider: ProviderConfig) {
    // Bridge the extension's ProviderConfig to core's LLM provider.
    // The extension currently only stores openai-compatible providers.
    const llmProvider = new OpenAICompatProvider({
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl ?? 'https://api.openai.com',
      model: provider.model ?? 'gpt-4o-mini',
    })
    this.extractor = new IntentExtractor(llmProvider)
  }

  /**
   * Process a single captured action and return the extracted intent step.
   * Errors are swallowed — the caller should still record the v1 trace entry.
   */
  async handleAction(capture: ActionCapturedPayload): Promise<IntentStep | PageBoundaryStep> {
    const step = await this.extractor.extractIntent({
      type: capture.type,
      element: capture.element,
      value: capture.value,
      url: capture.url,
      pageUrl: capture.pageUrl,
      pageTitle: capture.pageTitle,
      timestamp: capture.timestamp,
    })
    this.steps.push(step)
    return step
  }

  /**
   * Produce a v2 RecipeV2 from all accumulated intent steps.
   */
  finalize(name: string, startUrl: string): RecipeV2 {
    return {
      version: '2.0',
      id: crypto.randomUUID(),
      name,
      intent: `Automate: ${name}`,
      steps: this.steps,
      hosts: startUrl ? (() => { try { return [new URL(startUrl).hostname] } catch { return [] } })() : [],
      meta: {
        createdFrom: 'watch',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  reset(): void {
    this.steps = []
  }

  get stepCount(): number {
    return this.steps.length
  }
}
