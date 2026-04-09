export interface TraceEntry {
  type: 'click' | 'type' | 'navigate'
  selector?: string
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

  start(): void {
    this.entries = []
    this.startUrl = window.location.href

    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target) return
      this.entries.push({
        type: 'click',
        selector: buildSelector(target),
        timestamp: Date.now(),
      })
    }

    this.inputHandler = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (!target) return
      // Debounce: update last entry if same selector
      const selector = buildSelector(target)
      const last = this.entries[this.entries.length - 1]
      if (last && last.type === 'type' && last.selector === selector) {
        last.value = target.value
        last.timestamp = Date.now()
      } else {
        this.entries.push({
          type: 'type',
          selector,
          value: target.value,
          timestamp: Date.now(),
        })
      }
    }

    this.navHandler = () => {
      this.entries.push({
        type: 'navigate',
        url: window.location.href,
        timestamp: Date.now(),
      })
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
