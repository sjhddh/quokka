import { captureFallbacks } from './fallback-capture'
import { sendToBackground, MessageType, type ActionCapturedPayload } from '../../lib/messaging'
import { redactInputValue } from '@quokka/core'

export interface TraceEntry {
  type: 'click' | 'type' | 'navigate'
  selector?: string
  fallbackSelectors?: string[]
  value?: string
  url?: string
  timestamp: number
}

export interface WatchTrace {
  entries: TraceEntry[]
  url: string
}

function buildSelector(el: Element): string {
  // Prefer stable selectors
  if (el.id) return `#${el.id}`

  const testId = el.getAttribute('data-testid')
  if (testId) return `[data-testid="${testId}"]`

  // Build a CSS path
  return buildCssPath(el)
}

function buildCssPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el
  while (current && current !== document.documentElement) {
    let segment = current.tagName.toLowerCase()
    if (current.id) {
      parts.unshift(`#${current.id}`)
      break
    }
    const parent: Element | null = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c: Element) => c.tagName === current!.tagName
      )
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        segment += `:nth-of-type(${index})`
      }
    }
    parts.unshift(segment)
    current = parent
  }
  return parts.join(' > ')
}

export class WatchRecorder {
  private entries: TraceEntry[] = []
  private startUrl = ''
  private clickHandler: ((e: MouseEvent) => void) | null = null
  private inputHandler: ((e: Event) => void) | null = null
  private navHandler: ((e: BeforeUnloadEvent) => void) | null = null
  private onStep: ((entry: TraceEntry) => void) | null = null

  getEntryCount(): number {
    return this.entries.length
  }

  start(onStep?: (entry: TraceEntry) => void): void {
    this.entries = []
    this.startUrl = window.location.href
    this.onStep = onStep ?? null

    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target) return
      // Ignore clicks inside the quokka-pill element
      if (target.closest?.('quokka-pill')) return
      const selector = buildSelector(target)
      const entry: TraceEntry = {
        type: 'click',
        selector,
        fallbackSelectors: captureFallbacks(target),
        timestamp: Date.now(),
      }
      this.entries.push(entry)
      this.onStep?.(entry)

      // Send action to background for intent extraction (v2 flow)
      const capture: ActionCapturedPayload = {
        type: 'click',
        element: {
          tag: target.tagName.toLowerCase(),
          text: (target.textContent ?? '').trim().slice(0, 100) || undefined,
          ariaLabel: target.getAttribute('aria-label') ?? undefined,
          role: target.getAttribute('role') ?? undefined,
          selector,
        },
        pageUrl: window.location.href,
        pageTitle: document.title,
        timestamp: entry.timestamp,
      }
      sendToBackground({ type: MessageType.ACTION_CAPTURED, payload: capture }).catch(() => {})
    }

    this.inputHandler = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (!target) return
      if ((target as Element).closest?.('quokka-pill')) return
      // Debounce: update last entry if same selector
      const selector = buildSelector(target)
      const last = this.entries[this.entries.length - 1]
      const isNewEntry = !(last && last.type === 'type' && last.selector === selector)
      if (!isNewEntry) {
        last.value = target.value
        last.timestamp = Date.now()
      } else {
        const entry: TraceEntry = {
          type: 'type',
          selector,
          fallbackSelectors: captureFallbacks(target),
          value: target.value,
          timestamp: Date.now(),
        }
        this.entries.push(entry)
        this.onStep?.(entry)
      }

      // Send action to background for intent extraction (v2 flow)
      // Redact sensitive values before sending to background
      const { value: safeValue } = redactInputValue(target)
      const capture: ActionCapturedPayload = {
        type: 'type',
        element: {
          tag: target.tagName.toLowerCase(),
          ariaLabel: target.getAttribute('aria-label') ?? undefined,
          role: target.getAttribute('role') ?? undefined,
          placeholder: target.placeholder || undefined,
          name: target.name || undefined,
          type: target.type || undefined,
          selector,
        },
        value: safeValue,
        pageUrl: window.location.href,
        pageTitle: document.title,
        timestamp: Date.now(),
      }
      sendToBackground({ type: MessageType.ACTION_CAPTURED, payload: capture }).catch(() => {})
    }

    this.navHandler = () => {
      const now = Date.now()
      const entry: TraceEntry = {
        type: 'navigate',
        url: window.location.href,
        timestamp: now,
      }
      this.entries.push(entry)
      this.onStep?.(entry)

      // Send action to background for intent extraction (v2 flow)
      const capture: ActionCapturedPayload = {
        type: 'navigate',
        url: window.location.href,
        pageUrl: window.location.href,
        pageTitle: document.title,
        timestamp: now,
      }
      sendToBackground({ type: MessageType.ACTION_CAPTURED, payload: capture }).catch(() => {})
    }

    document.addEventListener('click', this.clickHandler, true)
    document.addEventListener('input', this.inputHandler, true)
    window.addEventListener('beforeunload', this.navHandler)
  }

  stop(): WatchTrace {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true)
    }
    if (this.inputHandler) {
      document.removeEventListener('input', this.inputHandler, true)
    }
    if (this.navHandler) {
      window.removeEventListener('beforeunload', this.navHandler)
    }

    this.clickHandler = null
    this.inputHandler = null
    this.navHandler = null

    return {
      entries: this.entries,
      url: this.startUrl,
    }
  }
}
