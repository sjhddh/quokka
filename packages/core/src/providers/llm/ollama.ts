import type { ChatMessage, CompletionOptions, JSONSchema, LLMProvider } from '../types.js'

const OLLAMA_BASE_URL = 'http://localhost:11434'

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama'
  private baseUrl: string
  private defaultModel: string

  constructor(baseUrl = OLLAMA_BASE_URL, model = 'llama3.2') {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.defaultModel = model
  }

  private async request(
    messages: ChatMessage[],
    options?: CompletionOptions,
    format?: 'json',
  ): Promise<string> {
    const ollamaMessages: OllamaMessage[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    const body: Record<string, unknown> = {
      model: options?.model ?? this.defaultModel,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        ...(options?.maxTokens ? { num_predict: options.maxTokens } : {}),
      },
    }

    if (format) {
      body.format = format
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`[ollama] API error ${response.status}: ${text}`)
    }

    const data = await response.json() as {
      message?: { content: string }
      error?: string
    }

    if (data.error) {
      throw new Error(`[ollama] ${data.error}`)
    }

    const content = data.message?.content
    if (typeof content !== 'string') {
      throw new Error('[ollama] No content in response')
    }
    return content
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<string> {
    return this.request(messages, options)
  }

  async completeJSON<T>(messages: ChatMessage[], _schema: JSONSchema, options?: CompletionOptions): Promise<T> {
    const text = await this.request(
      messages,
      { ...options, temperature: options?.temperature ?? 0.2 },
      'json',
    )

    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`[ollama] Failed to parse JSON response: ${text.slice(0, 200)}`)
    }
  }
}
