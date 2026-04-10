import type { ChatMessage, CompletionOptions, JSONSchema, LLMProvider } from '../types.js'

const FLOCK_BASE_URL = 'https://api.flock.io/v1'

export class FlockProvider implements LLMProvider {
  readonly name = 'flock'
  private apiKey: string
  private baseUrl: string
  private defaultModel: string

  constructor(apiKey: string, baseUrl = FLOCK_BASE_URL, model = 'qwen3-30b-a3b-instruct-2507') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.defaultModel = model
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-litellm-api-key': this.apiKey,
    }
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: options?.model ?? this.defaultModel,
        messages,
        temperature: options?.temperature ?? 0.7,
        ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
      signal: options?.signal,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      const msg = body?.error?.message ?? `API error ${response.status}`
      throw new Error(`[flock] ${msg}`)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content
    if (typeof content !== 'string') {
      throw new Error('[flock] No content in response')
    }
    return content
  }

  async completeJSON<T>(messages: ChatMessage[], _schema: JSONSchema, options?: CompletionOptions): Promise<T> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: options?.model ?? this.defaultModel,
        messages,
        temperature: options?.temperature ?? 0.2,
        ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
        response_format: { type: 'json_object' },
      }),
      signal: options?.signal,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      const msg = body?.error?.message ?? `API error ${response.status}`
      throw new Error(`[flock] ${msg}`)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content
    if (typeof content !== 'string') {
      throw new Error('[flock] No content in response')
    }

    try {
      return JSON.parse(content) as T
    } catch {
      throw new Error(`[flock] Failed to parse JSON response: ${content.slice(0, 200)}`)
    }
  }
}
