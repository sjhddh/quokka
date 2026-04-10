import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getProviders, saveProvider, deleteProvider, getActiveProvider, setActiveProvider } from '../lib/llm-storage'
import type { ProviderConfig } from '../lib/api'

// Mock chrome.storage.sync
const store: Record<string, unknown> = {}

const chromeMock = {
  storage: {
    sync: {
      get: vi.fn((keys: string | string[]) => {
        const k = Array.isArray(keys) ? keys : [keys]
        const result: Record<string, unknown> = {}
        for (const key of k) {
          if (key in store) result[key] = store[key]
        }
        return Promise.resolve(result)
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(store, items)
        return Promise.resolve()
      }),
      remove: vi.fn((keys: string | string[]) => {
        const k = Array.isArray(keys) ? keys : [keys]
        for (const key of k) {
          delete store[key]
        }
        return Promise.resolve()
      }),
    },
  },
}

// @ts-expect-error mock chrome global
globalThis.chrome = chromeMock

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'test-1',
    name: 'Test Provider',
    type: 'openai-compatible',
    apiKey: 'sk-test-key',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4o-mini',
    ...overrides,
  }
}

describe('llm-storage', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key]
    vi.clearAllMocks()
  })

  describe('getProviders', () => {
    it('returns empty array when no providers stored', async () => {
      const result = await getProviders()
      expect(result).toEqual([])
    })

    it('returns stored providers', async () => {
      const provider = makeProvider()
      store['quokka_providers'] = [provider]
      const result = await getProviders()
      expect(result).toEqual([provider])
    })
  })

  describe('saveProvider', () => {
    it('adds a new provider', async () => {
      const provider = makeProvider()
      await saveProvider(provider)
      expect(store['quokka_providers']).toEqual([provider])
    })

    it('updates an existing provider by id', async () => {
      const provider = makeProvider()
      store['quokka_providers'] = [provider]
      const updated = { ...provider, name: 'Updated' }
      await saveProvider(updated)
      expect(store['quokka_providers']).toEqual([updated])
    })

    it('appends when id does not exist', async () => {
      const first = makeProvider({ id: 'p1' })
      store['quokka_providers'] = [first]
      const second = makeProvider({ id: 'p2', name: 'Second' })
      await saveProvider(second)
      expect((store['quokka_providers'] as ProviderConfig[]).length).toBe(2)
    })
  })

  describe('deleteProvider', () => {
    it('removes a provider by id', async () => {
      const p1 = makeProvider({ id: 'p1' })
      const p2 = makeProvider({ id: 'p2' })
      store['quokka_providers'] = [p1, p2]
      await deleteProvider('p1')
      expect(store['quokka_providers']).toEqual([p2])
    })

    it('clears active provider if deleted provider was active', async () => {
      const provider = makeProvider({ id: 'p1' })
      store['quokka_providers'] = [provider]
      store['quokka_active_provider'] = 'p1'
      await deleteProvider('p1')
      expect(store['quokka_active_provider']).toBeUndefined()
    })

    it('does not clear active provider if a different one is deleted', async () => {
      const p1 = makeProvider({ id: 'p1' })
      const p2 = makeProvider({ id: 'p2' })
      store['quokka_providers'] = [p1, p2]
      store['quokka_active_provider'] = 'p1'
      await deleteProvider('p2')
      expect(store['quokka_active_provider']).toBe('p1')
    })
  })

  describe('getActiveProvider', () => {
    it('returns null when no active provider set', async () => {
      const result = await getActiveProvider()
      expect(result).toBeNull()
    })

    it('returns null when active id does not match any provider', async () => {
      store['quokka_active_provider'] = 'nonexistent'
      store['quokka_providers'] = [makeProvider({ id: 'p1' })]
      const result = await getActiveProvider()
      expect(result).toBeNull()
    })

    it('returns the active provider', async () => {
      const provider = makeProvider({ id: 'p1' })
      store['quokka_providers'] = [provider]
      store['quokka_active_provider'] = 'p1'
      const result = await getActiveProvider()
      expect(result).toEqual(provider)
    })
  })

  describe('setActiveProvider', () => {
    it('sets the active provider id', async () => {
      await setActiveProvider('p1')
      expect(store['quokka_active_provider']).toBe('p1')
    })
  })
})
