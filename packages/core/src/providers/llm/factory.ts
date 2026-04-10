import type { LLMProvider, ProviderConfig } from '../types.js'
import { AnthropicProvider } from './anthropic.js'
import { FlockProvider } from './flock.js'
import { GoogleProvider } from './google.js'
import { OllamaProvider } from './ollama.js'
import { OpenAICompatProvider } from './openai-compat.js'
import { OpenAIProvider } from './openai.js'

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider(
        config.apiKey ?? '',
        config.baseUrl,
        config.model,
      )

    case 'anthropic':
      return new AnthropicProvider(
        config.apiKey ?? '',
        config.model,
      )

    case 'google':
      return new GoogleProvider(
        config.apiKey ?? '',
        config.model,
      )

    case 'flock':
      return new FlockProvider(
        config.apiKey ?? '',
        config.baseUrl,
        config.model,
      )

    case 'ollama':
      return new OllamaProvider(
        config.baseUrl,
        config.model,
      )

    case 'openai-compatible':
      return new OpenAICompatProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        headers: config.headers,
      })

    default: {
      const exhaustive: never = config.type
      throw new Error(`Unknown provider type: ${exhaustive}`)
    }
  }
}
