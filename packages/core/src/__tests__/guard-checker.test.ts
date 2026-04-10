import { describe, it, expect, vi } from 'vitest'
import type { Guard } from '@quokka/shared'
import type { BrowserBridge } from '../runtime/bridge.js'
import { checkGuards } from '../runtime/guard-checker.js'

function createMockBridge(overrides?: Partial<BrowserBridge>): BrowserBridge {
  return {
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn().mockResolvedValue(undefined),
    extract: vi.fn().mockResolvedValue('extracted-data'),
    waitFor: vi.fn().mockResolvedValue(undefined),
    getUrl: vi.fn().mockResolvedValue('https://example.com/dashboard'),
    getTextContent: vi.fn().mockResolvedValue('Welcome back'),
    ...overrides,
  }
}

describe('checkGuards', () => {
  it('returns passed: true with empty guards array', async () => {
    const bridge = createMockBridge()
    const result = await checkGuards([], bridge)

    expect(result.passed).toBe(true)
    expect(result.results).toEqual([])
    expect(bridge.getUrl).not.toHaveBeenCalled()
  })

  it('returns passed: true when all guards pass', async () => {
    const bridge = createMockBridge()
    const guards: Guard[] = [
      { type: 'url', expect: 'example.com', timeout: 5000 },
      { type: 'dom', selector: '#main', expect: 'true', timeout: 5000 },
      { type: 'text', selector: '.greeting', expect: 'Welcome', timeout: 5000 },
    ]

    const result = await checkGuards(guards, bridge)

    expect(result.passed).toBe(true)
    expect(result.results).toHaveLength(3)
    expect(result.results.every((r) => r.passed)).toBe(true)
  })

  it('returns passed: false when URL guard fails', async () => {
    const bridge = createMockBridge({
      getUrl: vi.fn().mockResolvedValue('https://other-site.com'),
    })
    const guards: Guard[] = [
      { type: 'url', expect: 'example.com', timeout: 5000 },
    ]

    const result = await checkGuards(guards, bridge)

    expect(result.passed).toBe(false)
    expect(result.results[0].passed).toBe(false)
    expect(result.results[0].guardType).toBe('url')
    expect(result.results[0].actual).toBe('https://other-site.com')
  })

  it('returns passed: false when DOM guard fails (element not found)', async () => {
    const bridge = createMockBridge({
      getTextContent: vi.fn().mockRejectedValue(new Error('Element not found')),
    })
    const guards: Guard[] = [
      { type: 'dom', selector: '#missing', expect: 'true', timeout: 5000 },
    ]

    const result = await checkGuards(guards, bridge)

    expect(result.passed).toBe(false)
    expect(result.results[0].passed).toBe(false)
    expect(result.results[0].guardType).toBe('dom')
    expect(result.results[0].actual).toBe('false')
  })

  it('returns passed: false when text guard fails', async () => {
    const bridge = createMockBridge({
      getTextContent: vi.fn().mockResolvedValue('Goodbye'),
    })
    const guards: Guard[] = [
      { type: 'text', selector: '.greeting', expect: 'Welcome', timeout: 5000 },
    ]

    const result = await checkGuards(guards, bridge)

    expect(result.passed).toBe(false)
    expect(result.results[0].passed).toBe(false)
    expect(result.results[0].guardType).toBe('text')
    expect(result.results[0].actual).toBe('Goodbye')
  })
})
