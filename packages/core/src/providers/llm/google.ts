import type { ChatMessage, CompletionOptions, JSONSchema, LLMProvider } from '../types.js'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiContent {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

function toGeminiContents(messages: ChatMessage[]): { system?: string; contents: GeminiContent[] } {
  let system: string | undefined
  const contents: GeminiContent[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })
    }
  }

  return { system, contents }
}

export class GoogleProvider implements LLMProvider {
  readonly name = 'google'
  private apiKey: string
  private defaultModel: string

  constructor(apiKey: string, model = 'gemini-2.0-flash') {
    this.apiKey = apiKey
    this.defaultModel = model
  }

  private async request(
    messages: ChatMessage[],
    options?: CompletionOptions,
    responseMimeType?: string,
  ): Promise<string> {
    const model = options?.model ?? this.defaultModel
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${this.apiKey}`
    const { system, contents } = toGeminiContents(messages)

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
        ...(responseMimeType ? { responseMimeType } : {}),
      },
    }

    if (system) {
      body.systemInstruction = { parts: [{ text: system }] }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: { message?: string } }
      const msg = err?.error?.message ?? `API error ${response.status}`
      throw new Error(`[google] ${msg}`)
    }

    const data = await response.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>
    }
    const text = data.candidates[0]?.content?.parts[0]?.text
    if (typeof text !== 'string') {
      throw new Error('[google] No text in response')
    }
    return text
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<string> {
    return this.request(messages, options)
  }

  async completeJSON<T>(messages: ChatMessage[], _schema: JSONSchema, options?: CompletionOptions): Promise<T> {
    const text = await this.request(
      messages,
      { ...options, temperature: options?.temperature ?? 0.2 },
      'application/json',
    )

    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`[google] Failed to parse JSON response: ${text.slice(0, 200)}`)
    }
  }
}
