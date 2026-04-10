import type { ProviderConfig } from './api'

export interface LLMError {
  type: 'invalid_key' | 'rate_limit' | 'network' | 'unknown'
  message: string
}

export async function generateWithProvider(
  provider: ProviderConfig,
  prompt: string,
): Promise<string> {
  const baseUrl = (provider.baseUrl ?? 'https://api.openai.com').replace(/\/+$/, '')
  const model = provider.model ?? 'gpt-4o-mini'

  let res: Response
  try {
    res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    })
  } catch (err) {
    const llmErr: LLMError = {
      type: 'network',
      message: err instanceof Error ? err.message : 'Network error',
    }
    throw llmErr
  }

  if (!res.ok) {
    const errType: LLMError['type'] =
      res.status === 401 || res.status === 403
        ? 'invalid_key'
        : res.status === 429
          ? 'rate_limit'
          : 'unknown'
    let message = `API error ${res.status}`
    try {
      const body = await res.json()
      message = body?.error?.message ?? message
    } catch {
      // ignore parse error
    }
    const llmErr: LLMError = { type: errType, message }
    throw llmErr
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    const llmErr: LLMError = { type: 'unknown', message: 'No content in response' }
    throw llmErr
  }
  return content
}

/**
 * Quick connectivity test — sends a tiny prompt and checks for a valid response.
 */
export async function testConnection(provider: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    await generateWithProvider(provider, 'Say "ok" and nothing else.')
    return { ok: true }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as LLMError).message
        : 'Connection failed'
    return { ok: false, error: message }
  }
}
