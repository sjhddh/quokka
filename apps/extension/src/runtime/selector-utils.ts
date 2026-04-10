import type { Locator } from '@quokka/shared'
import { buildSelectorChain } from '@quokka/core/runtime'

/**
 * Resolve a Locator to a CSS selector string.
 * Priority: css > testId > ariaLabel > text (returns null for text-based).
 */
export function resolveSelector(locator: Locator): string {
  if (locator.css) return locator.css
  if (locator.testId) return `[data-testid="${locator.testId}"]`
  if (locator.ariaLabel) return `[aria-label="${locator.ariaLabel}"]`
  // text-based locator has no CSS equivalent — handled by findElement
  return ''
}

/**
 * Try every selector in the fallback chain until one matches.
 * Returns the first matching element, or null.
 */
export function tryFallbackChain(locator: Locator): HTMLElement | null {
  const chain = buildSelectorChain(locator)

  for (const selector of chain) {
    // Skip XPath and pseudo-selectors that querySelector can't handle
    if (selector.startsWith('/') || selector.includes(':has-text(')) {
      continue
    }
    try {
      const el = document.querySelector<HTMLElement>(selector)
      if (el) return el
    } catch {
      // Invalid selector — skip
    }
  }

  return null
}

/**
 * Find an element using a Locator with full fallback chain.
 * 1. CSS selector (css, testId, ariaLabel)
 * 2. Full fallback chain from buildSelectorChain
 * 3. Text content match
 */
export function findElement(locator: Locator): HTMLElement | null {
  // Try CSS-based selector first
  const cssSelector = resolveSelector(locator)
  if (cssSelector) {
    const el = document.querySelector<HTMLElement>(cssSelector)
    if (el) return el
  }

  // Try the full fallback chain (includes fallbackSelectors from recording)
  const fallbackEl = tryFallbackChain(locator)
  if (fallbackEl) return fallbackEl

  // Fallback: text content match
  if (locator.text) {
    return findByText(locator.text)
  }

  // If CSS selector didn't match and no text fallback, try aria-label as text fallback
  if (locator.ariaLabel && !document.querySelector(resolveSelector(locator))) {
    return findByText(locator.ariaLabel)
  }

  return null
}

/**
 * Find an element by its visible text content (case-insensitive, trimmed).
 */
function findByText(text: string): HTMLElement | null {
  const normalized = text.toLowerCase().trim()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as HTMLElement
      // Only match leaf-level elements with direct text
      if (el.children.length === 0 || el.childNodes.length === 1) {
        const content = el.textContent?.toLowerCase().trim()
        if (content === normalized || content?.includes(normalized)) {
          return NodeFilter.FILTER_ACCEPT
        }
      }
      return NodeFilter.FILTER_SKIP
    },
  })

  return walker.nextNode() as HTMLElement | null
}

/**
 * Wait for an element matching the locator to appear in the DOM.
 */
export function waitForElement(
  locator: Locator,
  timeout = 5000,
  interval = 200,
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const el = findElement(locator)
    if (el) {
      resolve(el)
      return
    }

    let elapsed = 0
    const timer = setInterval(() => {
      elapsed += interval
      const found = findElement(locator)
      if (found) {
        clearInterval(timer)
        resolve(found)
      } else if (elapsed >= timeout) {
        clearInterval(timer)
        reject(new Error(`Timed out waiting for element: ${JSON.stringify(locator)}`))
      }
    }, interval)
  })
}

/**
 * Interpolate slot template values in a string: {{key}} -> value
 */
export function interpolate(template: string, slotValues: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in slotValues) return slotValues[key]
    return `{{${key}}}`
  })
}
