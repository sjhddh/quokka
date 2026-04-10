import type { ChatMessage, CompletionOptions, JSONSchema, LLMProvider } from '../types.js'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic'
  private apiKey: string
  private defaultModel: string

  constructor(apiKey: string, model = 'claude-sonnet-4-5') {
    this.apiKey = apiKey
    this.defaultModel = model
  }

  private buildRequest(messages: ChatMessage[], options?: CompletionOptions, jsonMode = false) {
    // Anthropic separates system prompt from the messages array
    const systemMsg = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const body: Record<string, unknown> = {
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 4096,
      messages: chatMessages,
      temperature: options?.temperature ?? 0.7,
    }

    if (systemMsg) {
      body.system = systemMsg.content
    }

    if (jsonMode) {
      // Steer the model to respond with JSON via a prefilled assistant turn
      const last = chatMessages[chatMessages.length - 1]
      if (last?.role !== 'assistant') {
        body.messages = [...chatMessages, { role: 'assistant', content: '{' }]
      }
    }

    return body
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<string> {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(this.buildRequest(messages, options)),
      signal: options?.signal,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      const msg = body?.error?.message ?? `API error ${response.status}`
      throw new Error(`[anthropic] ${msg}`)
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>
    }
    const text = data.content.find(b => b.type === 'text')?.text
    if (typeof text !== 'string') {
      throw new Error('[anthropic] No text content in response')
    }
    return text
  }

  async completeJSON<T>(messages: ChatMessage[], _schema: JSONSchema, options?: CompletionOptions): Promise<T> {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(this.buildRequest(messages, { ...options, temperature: options?.temperature ?? 0.2 }, true)),
      signal: options?.signal,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      const msg = body?.error?.message ?? `API error ${response.status}`
      throw new Error(`[anthropic] ${msg}`)
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>
    }
    let text = data.content.find(b => b.type === 'text')?.text
    if (typeof text !== 'string') {
      throw new Error('[anthropic] No text content in response')
    }

    // When we prefill with '{', the response doesn't include it — prepend it back
    if (!text.trimStart().startsWith('{') && !text.trimStart().startsWith('[')) {
      text = '{' + text
    }

    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`[anthropic] Failed to parse JSON response: ${text.slice(0, 200)}`)
    }
  }
}
