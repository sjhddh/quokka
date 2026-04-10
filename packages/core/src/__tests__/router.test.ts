import { describe, it, expect } from 'vitest'
import { ModelRouter } from '../providers/router.js'
import type { ProviderConfig } from '../providers/provider.js'

const mockConfig: ProviderConfig = {
  id: 'test-mock',
  name: 'Test Mock',
  type: 'mock',
}

describe('ModelRouter', () => {
  it('registers a mock provider and routes to it', async () => {
    const router = new ModelRouter()
    router.register(mockConfig)

    const provider = router.route('test-mock')
    const result = await provider.complete('compile this recipe')
    expect(result).toBe('auto-login-flow')
  })

  it('returns plan steps for plan prompts', async () => {
    const router = new ModelRouter()
    router.register(mockConfig)

    const provider = router.route()
    const result = await provider.complete('plan the steps for login')
    expect(result).toContain('Navigate to the login page')
    expect(result).toContain('Click the submit button')
  })

  it('returns generic response for unknown prompts', async () => {
    const router = new ModelRouter()
    router.register(mockConfig)

    const provider = router.route()
    const result = await provider.complete('hello world')
    expect(result).toBe('mock-response-from-test-mock')
  })

  it('uses first registered provider as default', async () => {
    const router = new ModelRouter()
    router.register(mockConfig)
    router.register({ ...mockConfig, id: 'second', name: 'Second' })

    const provider = router.route()
    const result = await provider.complete('hello')
    expect(result).toBe('mock-response-from-test-mock')
  })

  it('throws when no providers registered', () => {
    const router = new ModelRouter()
    expect(() => router.route()).toThrow('No providers registered')
  })

  it('throws for unknown provider id', () => {
    const router = new ModelRouter()
    router.register(mockConfig)
    expect(() => router.route('nonexistent')).toThrow('Provider not found: nonexistent')
  })
})
