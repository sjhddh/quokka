export interface ModelProvider {
  complete(
    prompt: string,
    options?: { system?: string; temperature?: number }
  ): Promise<string>
}

export interface ProviderConfig {
  id: string
  name: string
  type: 'openai-compatible' | 'mock'
  apiKey?: string
  baseUrl?: string
  model?: string
}
