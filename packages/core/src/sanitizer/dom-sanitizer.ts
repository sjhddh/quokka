/**
 * DOM snapshot capture and sanitization.
 * Works in both browser (content script) and Node.js (testing via jsdom).
 */

export interface AccessNode {
  role: string
  name: string
  selector: string
  visible: boolean
  interactive: boolean
  tag: string
}

export interface PageSnapshot {
  url: string
  title: string
  structuralHash: string
  accessibilityTree: AccessNode[]
}

// ─── Prompt injection detection ──────────────────────────────────────────────

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:previous|all\s+previous)\s+instructions?/i,
  /system\s+prompt/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:an?\s+)?(?:different|new|another)/i,
  /disregard\s+(?:previous|all)\s+instructions?/i,
  /\[\s*(?:INST|SYS|SYSTEM)\s*\]/i,
  /<\s*system\s*>/i,
  /assistant:\s*i\s+will/i,
  /end\s+of\s+instructions?\s*[.!]/i,
]

function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text))
}

function sanitizeNodeName(raw: string): string {
  const trimmed = raw.trim()
  if (looksLikeInjection(trimmed)) return '[redacted]'
  return trimmed.slice(0, 100)
}

// ─── Visibility checks ────────────────────────────────────────────────────────

function isVisible(el: Element): boolean {
  // JSDOM / Node.js has no layout engine — treat everything as visible during tests
  if (typeof window === 'undefined' || typeof (el as HTMLElement).getBoundingClientRect !== 'function') {
    return true
  }

  const style = window.getComputedStyle(el)

  if (style.display === 'none') return false
  if (style.visibility === 'hidden') return false
  if (parseFloat(style.opacity) === 0) return false

  const fontSize = parseFloat(style.fontSize)
  if (!isNaN(fontSize) && fontSize < 2) return false

  // Off-viewport check
  const rect = (el as HTMLElement).getBoundingClientRect()
  const vw = window.innerWidth || document.documentElement.clientWidth
  const vh = window.innerHeight || document.documentElement.clientHeight
  if (rect.right < 0 || rect.bottom < 0 || rect.left > vw || rect.top > vh) return false

  return true
}

// ─── Interactivity checks ─────────────────────────────────────────────────────

const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea'])
const INTERACTIVE_ROLES = new Set(['button', 'link', 'checkbox', 'tab', 'menuitem', 'option', 'radio', 'switch', 'treeitem'])
const LANDMARK_TAGS = new Set(['nav', 'main', 'header', 'footer', 'form', 'dialog', 'aside', 'section'])

function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  if (INTERACTIVE_TAGS.has(tag)) return true

  const role = el.getAttribute('role')
  if (role && INTERACTIVE_ROLES.has(role.toLowerCase())) return true

  if (el.hasAttribute('onclick')) return true
  if ((el as HTMLElement).onclick != null) return true

  // tabindex >= 0 signals explicitly focusable / interactive
  const tabindex = el.getAttribute('tabindex')
  if (tabindex !== null && parseInt(tabindex, 10) >= 0) return true

  return false
}

function isLandmark(el: Element): boolean {
  return LANDMARK_TAGS.has(el.tagName.toLowerCase())
}

// ─── Selector building (mirrors recorder.ts logic) ───────────────────────────

function buildSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`

  const testId = el.getAttribute('data-testid')
  if (testId) return `[data-testid="${testId}"]`

  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return `[aria-label="${ariaLabel}"]`

  return buildCssPath(el)
}

function buildCssPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el

  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase()

    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`)
      break
    }

    const parent: Element | null = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c: Element) => c.tagName === current!.tagName,
      )
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        parts.unshift(`${tag}:nth-of-type(${index})`)
      } else {
        parts.unshift(tag)
      }
    } else {
      parts.unshift(tag)
    }

    current = parent
  }

  return parts.join(' > ')
}

// ─── Name resolution ──────────────────────────────────────────────────────────

function resolveNodeName(el: Element): string {
  // Prefer explicit labels
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel

  const ariaLabelledby = el.getAttribute('aria-labelledby')
  if (ariaLabelledby) {
    const labelEl = document.getElementById(ariaLabelledby)
    if (labelEl?.textContent) return labelEl.textContent.trim()
  }

  // For inputs, prefer placeholder or label element
  if (el.tagName.toLowerCase() === 'input') {
    const placeholder = (el as HTMLInputElement).placeholder
    if (placeholder) return placeholder

    const id = el.id
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`)
      if (label?.textContent) return label.textContent.trim()
    }
  }

  const title = el.getAttribute('title')
  if (title) return title

  const alt = el.getAttribute('alt')
  if (alt) return alt

  return el.textContent?.trim() ?? ''
}

// ─── Role resolution ──────────────────────────────────────────────────────────

function resolveRole(el: Element): string {
  const explicitRole = el.getAttribute('role')
  if (explicitRole) return explicitRole

  const tag = el.tagName.toLowerCase()
  const type = (el as HTMLInputElement).type?.toLowerCase()

  switch (tag) {
    case 'button': return 'button'
    case 'a': return 'link'
    case 'nav': return 'navigation'
    case 'main': return 'main'
    case 'header': return 'banner'
    case 'footer': return 'contentinfo'
    case 'form': return 'form'
    case 'dialog': return 'dialog'
    case 'select': return 'combobox'
    case 'textarea': return 'textbox'
    case 'input':
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      if (type === 'submit' || type === 'button' || type === 'reset') return 'button'
      return 'textbox'
    default: return tag
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

import { computeStructuralHash } from './structural-hash.js'

/**
 * Capture a sanitized accessibility snapshot of the current document.
 * Includes only visible interactive elements and structural landmarks.
 */
export function capturePageSnapshot(doc: Document): PageSnapshot {
  const nodes: AccessNode[] = []

  // Use a TreeWalker to iterate all elements efficiently
  const walker = doc.createTreeWalker(doc.body ?? doc.documentElement, NodeFilter.SHOW_ELEMENT)

  let el: Element | null = walker.currentNode as Element

  while (el) {
    const tag = el.tagName.toLowerCase()

    // Must be interactive or a landmark to include
    const interactive = isInteractive(el)
    const landmark = isLandmark(el)

    if (interactive || landmark) {
      const visible = isVisible(el)

      const rawName = resolveNodeName(el)
      const name = sanitizeNodeName(rawName)

      let selector: string
      try {
        selector = buildSelector(el)
      } catch {
        selector = tag
      }

      nodes.push({
        role: resolveRole(el),
        name,
        selector,
        visible,
        interactive,
        tag,
      })
    }

    el = walker.nextNode() as Element | null
  }

  const structuralHash = computeStructuralHash(nodes)

  return {
    url: typeof window !== 'undefined' ? window.location.href : doc.URL ?? '',
    title: doc.title,
    structuralHash,
    accessibilityTree: nodes,
  }
}
