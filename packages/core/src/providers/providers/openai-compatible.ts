import type { ModelProvider, ProviderConfig } from '../provider.js'

export class OpenAICompatibleProvider implements ModelProvider {
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey ?? ''
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '')
    this.model = config.model ?? 'gpt-4o-mini'
  }

  async complete(
    prompt: string,
    options?: { system?: string; temperature?: number }
  ): Promise<string> {
    const messages: Array<{ role: string; content: string }> = []

    if (options?.system) {
      messages.push({ role: 'system', content: options.system })
    }
    messages.push({ role: 'user', content: prompt })

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.7,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Model API error ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }

    return data.choices[0]?.message?.content ?? ''
  }
}
