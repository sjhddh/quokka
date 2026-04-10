import type { ModelProvider, ProviderConfig } from './provider.js'
import { MockProvider } from './providers/mock.js'
import { OpenAICompatibleProvider } from './providers/openai-compatible.js'

export class ModelRouter {
  private providers = new Map<string, ModelProvider>()
  private defaultId: string | undefined

  register(config: ProviderConfig): void {
    let provider: ModelProvider
    switch (config.type) {
      case 'mock':
        provider = new MockProvider(config)
        break
      case 'openai-compatible':
        provider = new OpenAICompatibleProvider(config)
        break
      default:
        throw new Error(`Unknown provider type: ${(config as ProviderConfig).type}`)
    }
    this.providers.set(config.id, provider)
    if (!this.defaultId) {
      this.defaultId = config.id
    }
  }

  unregister(id: string): boolean {
    const existed = this.providers.delete(id)
    if (this.defaultId === id) {
      const first = this.providers.keys().next()
      this.defaultId = first.done ? undefined : first.value
    }
    return existed
  }

  route(providerId?: string): ModelProvider {
    const id = providerId ?? this.defaultId
    if (!id) {
      throw new Error('No providers registered')
    }
    const provider = this.providers.get(id)
    if (!provider) {
      throw new Error(`Provider not found: ${id}`)
    }
    return provider
  }
}
