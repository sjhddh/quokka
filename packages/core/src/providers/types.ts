export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

// Minimal JSON Schema subset sufficient for structured output
export type JSONSchema = Record<string, unknown>

export interface LLMProvider {
  name: string
  complete(messages: ChatMessage[], options?: CompletionOptions): Promise<string>
  completeJSON<T>(messages: ChatMessage[], schema: JSONSchema, options?: CompletionOptions): Promise<T>
}

export interface ProviderConfig {
  type: 'openai' | 'anthropic' | 'google' | 'flock' | 'ollama' | 'openai-compatible'
  apiKey?: string
  baseUrl?: string
  model?: string
  headers?: Record<string, string>
}
