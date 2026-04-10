import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateWithProvider, testConnection } from '../lib/llm-client'
import type { ProviderConfig } from '../lib/api'

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'test-1',
    name: 'Test Provider',
    type: 'openai-compatible',
    apiKey: 'sk-test-key',
    baseUrl: 'https://api.example.com',
    model: 'gpt-4o-mini',
    ...overrides,
  }
}

describe('llm-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateWithProvider', () => {
    it('sends correct request and returns content', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Hello world' } }],
          }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await generateWithProvider(makeProvider(), 'test prompt')

      expect(result).toBe('Hello world')
      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.example.com/v1/chat/completions')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toMatchObject({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test prompt' }],
      })
      expect(init.headers['Authorization']).toBe('Bearer sk-test-key')
    })

    it('uses default base URL when none provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'ok' } }],
          }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await generateWithProvider(makeProvider({ baseUrl: undefined }), 'test')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.openai.com/v1/chat/completions')
    })

    it('strips trailing slashes from base URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'ok' } }],
          }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await generateWithProvider(makeProvider({ baseUrl: 'https://api.example.com/' }), 'test')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.example.com/v1/chat/completions')
    })

    it('throws network error when fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

      try {
        await generateWithProvider(makeProvider(), 'test')
        expect.unreachable('should have thrown')
      } catch (err: unknown) {
        const e = err as { type: string; message: string }
        expect(e.type).toBe('network')
        expect(e.message).toBe('Network failure')
      }
    })

    it('throws invalid_key error on 401', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
        }),
      )

      try {
        await generateWithProvider(makeProvider(), 'test')
        expect.unreachable('should have thrown')
      } catch (err: unknown) {
        const e = err as { type: string; message: string }
        expect(e.type).toBe('invalid_key')
        expect(e.message).toBe('Invalid API key')
      }
    })

    it('throws rate_limit error on 429', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ error: { message: 'Rate limited' } }),
        }),
      )

      try {
        await generateWithProvider(makeProvider(), 'test')
        expect.unreachable('should have thrown')
      } catch (err: unknown) {
        const e = err as { type: string; message: string }
        expect(e.type).toBe('rate_limit')
      }
    })

    it('throws unknown error when response has no content', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ choices: [] }),
        }),
      )

      try {
        await generateWithProvider(makeProvider(), 'test')
        expect.unreachable('should have thrown')
      } catch (err: unknown) {
        const e = err as { type: string; message: string }
        expect(e.type).toBe('unknown')
        expect(e.message).toBe('No content in response')
      }
    })

    it('omits Authorization header when no API key', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'ok' } }],
          }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await generateWithProvider(makeProvider({ apiKey: undefined }), 'test')

      const [, init] = mockFetch.mock.calls[0]
      expect(init.headers['Authorization']).toBeUndefined()
    })
  })

  describe('testConnection', () => {
    it('returns ok: true on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'ok' } }],
            }),
        }),
      )

      const result = await testConnection(makeProvider())
      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns ok: false with error message on failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: { message: 'Bad key' } }),
        }),
      )

      const result = await testConnection(makeProvider())
      expect(result.ok).toBe(false)
      expect(result.error).toBe('Bad key')
    })
  })
})
