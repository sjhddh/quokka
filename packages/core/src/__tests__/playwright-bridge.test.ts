import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BrowserBridge } from '../runtime/bridge.js'
import { PlaywrightBridge } from '../headless/playwright-bridge.js'

function createMockPage() {
  return {
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    $$eval: vi.fn().mockResolvedValue(['Hello', 'World']),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('https://example.com/page'),
    textContent: vi.fn().mockResolvedValue('Some text'),
    setDefaultTimeout: vi.fn(),
  }
}

describe('PlaywrightBridge', () => {
  let mockPage: ReturnType<typeof createMockPage>
  let bridge: PlaywrightBridge

  beforeEach(() => {
    mockPage = createMockPage()
    bridge = new PlaywrightBridge(mockPage as any)
  })

  it('implements all BrowserBridge methods', () => {
    const requiredMethods: (keyof BrowserBridge)[] = [
      'click',
      'type',
      'navigate',
      'extract',
      'waitFor',
      'getUrl',
      'getTextContent',
    ]

    for (const method of requiredMethods) {
      expect(typeof bridge[method]).toBe('function')
    }
  })

  it('click delegates to page.click', async () => {
    await bridge.click('#btn')
    expect(mockPage.click).toHaveBeenCalledWith('#btn')
  })

  it('type delegates to page.fill', async () => {
    await bridge.type('#input', 'hello')
    expect(mockPage.fill).toHaveBeenCalledWith('#input', 'hello')
  })

  it('navigate delegates to page.goto with domcontentloaded', async () => {
    await bridge.navigate('https://example.com')
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'domcontentloaded',
    })
  })

  it('extract delegates to page.$$eval and joins with newlines', async () => {
    const result = await bridge.extract('.items')
    expect(mockPage.$$eval).toHaveBeenCalledWith('.items', expect.any(Function))
    expect(typeof result).toBe('string')
  })

  it('waitFor delegates to page.waitForSelector', async () => {
    await bridge.waitFor('.loading', 5000)
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('.loading', { timeout: 5000 })
  })

  it('waitFor works without timeout', async () => {
    await bridge.waitFor('.loading')
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('.loading', { timeout: undefined })
  })

  it('getUrl delegates to page.url', async () => {
    const url = await bridge.getUrl()
    expect(url).toBe('https://example.com/page')
    expect(mockPage.url).toHaveBeenCalled()
  })

  it('getTextContent delegates to page.textContent', async () => {
    const text = await bridge.getTextContent('.heading')
    expect(text).toBe('Some text')
    expect(mockPage.textContent).toHaveBeenCalledWith('.heading')
  })

  it('getTextContent returns empty string when textContent returns null', async () => {
    mockPage.textContent.mockResolvedValue(null)
    const text = await bridge.getTextContent('.empty')
    expect(text).toBe('')
  })
})

describe('runHeadless', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  function makeRecipe(steps: any[]) {
    return {
      id: 'test',
      name: 'Test',
      version: '0.1.0',
      hosts: ['example.com'],
      slots: [],
      guards: [],
      steps,
      meta: { createdFrom: 'code' as const, tags: [] },
    }
  }

  it('launches browser, runs recipe, and closes browser', async () => {
    const mockPage = createMockPage()
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    }

    vi.doMock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockResolvedValue(mockBrowser),
      },
    }))

    const { runHeadless } = await import('../headless/headless-runner.js')

    const recipe = makeRecipe([
      { type: 'navigate' as const, url: 'https://example.com' },
      { type: 'click' as const, target: { css: '#btn' } },
    ])

    const result = await runHeadless(recipe, {})

    expect(result.status).toBe('completed')
    expect(result.events.length).toBeGreaterThan(0)
    expect(result.run).toBeDefined()
    expect(mockBrowser.close).toHaveBeenCalled()
  })

  it('returns failure when browser launch fails', async () => {
    vi.doMock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockRejectedValue(new Error('Browser not installed')),
      },
    }))

    const { runHeadless } = await import('../headless/headless-runner.js')

    const recipe = makeRecipe([
      { type: 'navigate' as const, url: 'https://example.com' },
    ])

    const result = await runHeadless(recipe, {})
    expect(result.status).toBe('failed')
    expect(result.error).toContain('Browser not installed')
  })

  it('calls onEvent callback for each event', async () => {
    const mockPage = createMockPage()
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    }

    vi.doMock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockResolvedValue(mockBrowser),
      },
    }))

    const { runHeadless } = await import('../headless/headless-runner.js')

    const recipe = makeRecipe([
      { type: 'navigate' as const, url: 'https://example.com' },
    ])

    const capturedEvents: any[] = []
    const result = await runHeadless(recipe, {}, {
      onEvent: (event) => capturedEvents.push(event),
    })

    expect(result.status).toBe('completed')
    expect(capturedEvents.length).toBe(result.events.length)
  })
})
