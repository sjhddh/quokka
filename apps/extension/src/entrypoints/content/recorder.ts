import { captureFallbacks } from './fallback-capture'

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
      const entry: TraceEntry = {
        type: 'click',
        selector: buildSelector(target),
        fallbackSelectors: captureFallbacks(target),
        timestamp: Date.now(),
      }
      this.entries.push(entry)
      this.onStep?.(entry)
    }

    this.inputHandler = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (!target) return
      if ((target as Element).closest?.('quokka-pill')) return
      // Debounce: update last entry if same selector
      const selector = buildSelector(target)
      const last = this.entries[this.entries.length - 1]
      if (last && last.type === 'type' && last.selector === selector) {
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
    }

    this.navHandler = () => {
      const entry: TraceEntry = {
        type: 'navigate',
        url: window.location.href,
        timestamp: Date.now(),
      }
      this.entries.push(entry)
      this.onStep?.(entry)
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
