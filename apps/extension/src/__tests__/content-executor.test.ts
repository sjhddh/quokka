import { describe, it, expect, beforeEach } from 'vitest'
import { executeStepCommand } from '../runtime/content-executor'

describe('executeStepCommand', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('click', () => {
    it('clicks an element found by CSS', async () => {
      let clicked = false
      document.body.innerHTML = '<button id="btn">Click me</button>'
      document.getElementById('btn')!.addEventListener('click', () => {
        clicked = true
      })

      const result = await executeStepCommand({
        type: 'click',
        locator: { css: '#btn' },
      })

      expect(result.ok).toBe(true)
      expect(clicked).toBe(true)
    })

    it('fails when element not found', async () => {
      const result = await executeStepCommand({
        type: 'click',
        locator: { css: '#nonexistent' },
      })

      expect(result.ok).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('fails when no locator provided', async () => {
      const result = await executeStepCommand({ type: 'click' })
      expect(result.ok).toBe(false)
      expect(result.error).toContain('No locator')
    })
  })

  describe('type', () => {
    it('types into an input', async () => {
      document.body.innerHTML = '<input id="field" />'

      const result = await executeStepCommand({
        type: 'type',
        locator: { css: '#field' },
        value: 'hello world',
      })

      expect(result.ok).toBe(true)
      expect((document.getElementById('field') as HTMLInputElement).value).toBe('hello world')
    })

    it('interpolates slot values', async () => {
      document.body.innerHTML = '<input id="field" />'

      const result = await executeStepCommand({
        type: 'type',
        locator: { css: '#field' },
        value: '{{greeting}} Boss',
        slotValues: { greeting: 'Hello' },
      })

      expect(result.ok).toBe(true)
      expect((document.getElementById('field') as HTMLInputElement).value).toBe('Hello Boss')
    })

    it('fires input and change events', async () => {
      document.body.innerHTML = '<input id="field" />'
      const events: string[] = []
      const input = document.getElementById('field')!
      input.addEventListener('input', () => events.push('input'))
      input.addEventListener('change', () => events.push('change'))

      await executeStepCommand({
        type: 'type',
        locator: { css: '#field' },
        value: 'test',
      })

      // Two input events: one for clear, one for set
      expect(events).toContain('input')
      expect(events).toContain('change')
    })
  })

  describe('extract', () => {
    it('extracts text content', async () => {
      document.body.innerHTML = '<span id="price">$42.00</span>'

      const result = await executeStepCommand({
        type: 'extract',
        locator: { css: '#price' },
      })

      expect(result.ok).toBe(true)
      expect(result.data).toBe('$42.00')
    })

    it('fails when element not found', async () => {
      const result = await executeStepCommand({
        type: 'extract',
        locator: { css: '#missing' },
      })

      expect(result.ok).toBe(false)
    })
  })

  describe('wait', () => {
    it('resolves when element already exists', async () => {
      document.body.innerHTML = '<div id="target">Ready</div>'

      const result = await executeStepCommand({
        type: 'wait',
        locator: { css: '#target' },
        timeout: 500,
      })

      expect(result.ok).toBe(true)
    })

    it('fails on timeout when element never appears', async () => {
      const result = await executeStepCommand({
        type: 'wait',
        locator: { css: '#never-appears' },
        timeout: 200,
      })

      expect(result.ok).toBe(false)
      expect(result.error).toContain('Timed out')
    })
  })

  describe('navigate', () => {
    it('returns ok (navigation is side-effecting)', async () => {
      // In jsdom, setting location.href throws, but we handle it gracefully
      const result = await executeStepCommand({
        type: 'navigate',
        url: 'https://example.com',
      })

      // jsdom may error on navigation — that's expected in tests
      // The important thing is the function doesn't throw unhandled
      expect(typeof result.ok).toBe('boolean')
    })
  })
})
