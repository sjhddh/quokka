/**
 * DOM snapshot capture via Playwright's page.evaluate().
 *
 * Mirrors the logic in @quokka/core's dom-sanitizer.ts but runs inside
 * Playwright's browser context rather than a content script.
 */

import type { Page } from 'playwright'
import type { AccessNode, PageSnapshot } from '@quokka/core'
import { computeStructuralHash } from '@quokka/core'

// ─── Browser-side capture function ───────────────────────────────────────────

/**
 * This function is serialized and executed inside the browser via page.evaluate().
 * It must be self-contained — no closures over Node.js scope.
 */
function browserCaptureSnapshot(): {
  url: string
  title: string
  nodes: Array<{
    role: string
    name: string
    selector: string
    visible: boolean
    interactive: boolean
    tag: string
  }>
} {
  // ── Constants (duplicated here because this runs in browser context) ──
  const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea'])
  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'checkbox', 'tab', 'menuitem',
    'option', 'radio', 'switch', 'treeitem',
  ])
  const LANDMARK_TAGS = new Set([
    'nav', 'main', 'header', 'footer', 'form', 'dialog', 'aside', 'section',
  ])

  // ── Prompt injection detection ──
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

  function sanitizeNodeName(raw: string): string {
    const trimmed = raw.trim()
    if (INJECTION_PATTERNS.some((re) => re.test(trimmed))) return '[redacted]'
    return trimmed.slice(0, 100)
  }

  // ── Visibility ──
  function isVisible(el: Element): boolean {
    const style = window.getComputedStyle(el)
    if (style.display === 'none') return false
    if (style.visibility === 'hidden') return false
    if (parseFloat(style.opacity) === 0) return false

    const fontSize = parseFloat(style.fontSize)
    if (!isNaN(fontSize) && fontSize < 2) return false

    const rect = (el as HTMLElement).getBoundingClientRect()
    const vw = window.innerWidth || document.documentElement.clientWidth
    const vh = window.innerHeight || document.documentElement.clientHeight
    if (rect.right < 0 || rect.bottom < 0 || rect.left > vw || rect.top > vh) return false

    return true
  }

  // ── Interactivity ──
  function isInteractive(el: Element): boolean {
    const tag = el.tagName.toLowerCase()
    if (INTERACTIVE_TAGS.has(tag)) return true

    const role = el.getAttribute('role')
    if (role && INTERACTIVE_ROLES.has(role.toLowerCase())) return true

    if (el.hasAttribute('onclick')) return true
    if ((el as HTMLElement).onclick != null) return true

    const tabindex = el.getAttribute('tabindex')
    if (tabindex !== null && parseInt(tabindex, 10) >= 0) return true

    return false
  }

  function isLandmark(el: Element): boolean {
    return LANDMARK_TAGS.has(el.tagName.toLowerCase())
  }

  // ── Selector building ──
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

  // ── Name resolution ──
  function resolveNodeName(el: Element): string {
    const ariaLabel = el.getAttribute('aria-label')
    if (ariaLabel) return ariaLabel

    const ariaLabelledby = el.getAttribute('aria-labelledby')
    if (ariaLabelledby) {
      const labelEl = document.getElementById(ariaLabelledby)
      if (labelEl?.textContent) return labelEl.textContent.trim()
    }

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

  // ── Role resolution ──
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

  // ── Walk the DOM ──
  const nodes: Array<{
    role: string
    name: string
    selector: string
    visible: boolean
    interactive: boolean
    tag: string
  }> = []

  const walker = document.createTreeWalker(
    document.body ?? document.documentElement,
    NodeFilter.SHOW_ELEMENT,
  )

  let el: Element | null = walker.currentNode as Element

  while (el) {
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
        selector = el.tagName.toLowerCase()
      }

      nodes.push({
        role: resolveRole(el),
        name,
        selector,
        visible,
        interactive,
        tag: el.tagName.toLowerCase(),
      })
    }

    el = walker.nextNode() as Element | null
  }

  return {
    url: window.location.href,
    title: document.title,
    nodes,
  }
}

// ─── Playwright-side capture ─────────────────────────────────────────────────

/**
 * Capture a DOM snapshot from a Playwright page.
 * Runs the DOM walker inside the browser context via page.evaluate(),
 * then computes the structural hash on the Node.js side.
 */
export async function capturePlaywrightSnapshot(page: Page): Promise<PageSnapshot> {
  const raw = await page.evaluate(browserCaptureSnapshot)

  const accessibilityTree: AccessNode[] = raw.nodes.map((n) => ({
    role: n.role,
    name: n.name,
    selector: n.selector,
    visible: n.visible,
    interactive: n.interactive,
    tag: n.tag,
  }))

  const structuralHash = computeStructuralHash(accessibilityTree)

  return {
    url: raw.url,
    title: raw.title,
    structuralHash,
    accessibilityTree,
  }
}
