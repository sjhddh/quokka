import type { ChatMessage, CompletionOptions, JSONSchema, LLMProvider } from '../types.js'

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai'
  private apiKey: string
  private baseUrl: string
  private defaultModel: string

  constructor(apiKey: string, baseUrl = 'https://api.openai.com', model = 'gpt-4o') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.defaultModel = model
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
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
      throw new Error(`[openai] ${msg}`)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content
    if (typeof content !== 'string') {
      throw new Error('[openai] No content in response')
    }
    return content
  }

  async completeJSON<T>(messages: ChatMessage[], _schema: JSONSchema, options?: CompletionOptions): Promise<T> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
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
      throw new Error(`[openai] ${msg}`)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content
    if (typeof content !== 'string') {
      throw new Error('[openai] No content in response')
    }

    try {
      return JSON.parse(content) as T
    } catch {
      throw new Error(`[openai] Failed to parse JSON response: ${content.slice(0, 200)}`)
    }
  }
}
