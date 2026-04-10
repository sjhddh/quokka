import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkAuthContext, type AuthCheck } from '../runtime/auth-detector'
import type { Recipe } from '@quokka/shared'

function makeRecipe(hosts: string[]): Recipe {
  return {
    id: 'test',
    name: 'Test',
    version: '0.1.0',
    schemaVersion: 1,
    hosts,
    slots: [],
    guards: [],
    steps: [],
    meta: { createdFrom: 'code', tags: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const mockGetAll = vi.fn()

vi.stubGlobal('chrome', {
  cookies: {
    getAll: mockGetAll,
  },
})

beforeEach(() => {
  mockGetAll.mockReset()
})

describe('checkAuthContext', () => {
  it('returns hasAuth=true when auth cookies exist', async () => {
    mockGetAll.mockResolvedValue([
      { name: 'session_id', value: 'abc123' },
      { name: 'preference', value: 'dark' },
    ])

    const result = await checkAuthContext(makeRecipe(['linkedin.com']))

    expect(result.hasAuth).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('warns when no auth cookies found for a domain', async () => {
    mockGetAll.mockResolvedValue([
      { name: 'preference', value: 'dark' },
      { name: 'tracking_id', value: '12345' },
    ])

    const result = await checkAuthContext(makeRecipe(['linkedin.com']))

    expect(result.hasAuth).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('linkedin.com')
    expect(result.warnings[0]).toContain('sign in')
  })

  it('checks multiple hosts independently', async () => {
    mockGetAll.mockImplementation(async ({ domain }: { domain: string }) => {
      if (domain === 'github.com') {
        return [{ name: 'session', value: 'xyz' }]
      }
      return [{ name: 'lang', value: 'en' }]
    })

    const result = await checkAuthContext(makeRecipe(['github.com', 'linkedin.com']))

    expect(result.hasAuth).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('linkedin.com')
  })

  it('returns hasAuth=true for recipe with no hosts', async () => {
    const result = await checkAuthContext(makeRecipe([]))

    expect(result.hasAuth).toBe(true)
    expect(result.warnings).toHaveLength(0)
    expect(mockGetAll).not.toHaveBeenCalled()
  })

  it('recognizes various auth cookie patterns', async () => {
    const authCookieNames = ['session', 'token', 'auth_token', 'sid', 'jwt', 'JSESSIONID', 'PHPSESSID', 'connect.sid']

    for (const name of authCookieNames) {
      mockGetAll.mockResolvedValue([{ name, value: 'val' }])
      const result = await checkAuthContext(makeRecipe(['example.com']))
      expect(result.hasAuth).toBe(true)
      expect(result.warnings).toHaveLength(0)
    }
  })

  it('handles cookie API errors gracefully', async () => {
    mockGetAll.mockRejectedValue(new Error('Permission denied'))

    const result = await checkAuthContext(makeRecipe(['example.com']))

    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('Could not check')
  })

  it('extracts domain from full URLs in hosts', async () => {
    mockGetAll.mockResolvedValue([{ name: 'session', value: 'abc' }])

    await checkAuthContext(makeRecipe(['https://app.example.com/login']))

    expect(mockGetAll).toHaveBeenCalledWith({ domain: 'app.example.com' })
  })
})
