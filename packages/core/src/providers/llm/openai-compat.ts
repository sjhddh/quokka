import type { ChatMessage, CompletionOptions, JSONSchema, LLMProvider, ProviderConfig } from '../types.js'

/**
 * Generic OpenAI-compatible provider for any endpoint that speaks the OpenAI chat completions API.
 * Supports custom auth headers (e.g. for FLOCK, local proxies, etc.).
 */
export class OpenAICompatProvider implements LLMProvider {
  readonly name = 'openai-compatible'
  private baseUrl: string
  private defaultModel: string
  private authHeaders: Record<string, string>
  private extraHeaders: Record<string, string>

  constructor(config: Pick<ProviderConfig, 'apiKey' | 'baseUrl' | 'model' | 'headers'>) {
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com').replace(/\/+$/, '')
    this.defaultModel = config.model ?? 'gpt-4o-mini'
    this.authHeaders = config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}
    this.extraHeaders = config.headers ?? {}
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.authHeaders,
      ...this.extraHeaders,
    }
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.headers,
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
      throw new Error(`[openai-compatible] ${msg}`)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content
    if (typeof content !== 'string') {
      throw new Error('[openai-compatible] No content in response')
    }
    return content
  }

  async completeJSON<T>(messages: ChatMessage[], _schema: JSONSchema, options?: CompletionOptions): Promise<T> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.headers,
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
      throw new Error(`[openai-compatible] ${msg}`)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content
    if (typeof content !== 'string') {
      throw new Error('[openai-compatible] No content in response')
    }

    try {
      return JSON.parse(content) as T
    } catch {
      throw new Error(`[openai-compatible] Failed to parse JSON response: ${content.slice(0, 200)}`)
    }
  }
}
