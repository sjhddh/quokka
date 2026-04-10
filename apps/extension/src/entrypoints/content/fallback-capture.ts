/**
 * Capture fallback selectors for an element during recording.
 * All functions are synchronous — safe to call in event handlers.
 */

/** Escape an ID for use in a CSS selector. Uses CSS.escape when available, else simple fallback. */
function escapeCssId(id: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(id)
  // Simple fallback: escape characters that are invalid in CSS identifiers
  return id.replace(/([^\w-])/g, '\\$1')
}

/**
 * Build an nth-child path from an element to the nearest ancestor with an ID,
 * or to `body` if none exists.
 */
export function buildNthChildPath(element: Element): string {
  const parts: string[] = []
  let current: Element | null = element

  while (current && current !== document.documentElement && current !== document.body) {
    const tag = current.tagName.toLowerCase()

    if (current.id) {
      parts.unshift(`#${escapeCssId(current.id)}`)
      return parts.join(' > ')
    }

    const parent = current.parentElement
    if (parent) {
      const children = Array.from(parent.children)
      const index = children.indexOf(current) + 1
      parts.unshift(`${tag}:nth-child(${index})`)
    } else {
      parts.unshift(tag)
    }

    current = parent
  }

  if (parts.length > 0) {
    parts.unshift('body')
  }

  return parts.join(' > ')
}

/**
 * Build a combined tag + partial class match selector.
 * Returns null if the element has no classes.
 */
function buildTagClassSelector(element: Element): string | null {
  const tag = element.tagName.toLowerCase()
  const classList = Array.from(element.classList)
  if (classList.length === 0) return null
  // Pick the longest class name as most likely distinctive
  const best = classList.reduce((a, b) => (a.length >= b.length ? a : b))
  return `${tag}[class*="${best}"]`
}

/**
 * Generate 3+ alternative selectors for an element.
 * Called synchronously during recording event capture.
 *
 * Strategies attempted:
 *  1. aria-label
 *  2. data-testid
 *  3. Text content (XPath contains)
 *  4. nth-child path from nearest ID'd ancestor
 *  5. Tag + partial class match
 */
export function captureFallbacks(element: Element): string[] {
  const selectors: string[] = []
  const seen = new Set<string>()

  function add(s: string | null | undefined) {
    if (s && !seen.has(s)) {
      seen.add(s)
      selectors.push(s)
    }
  }

  // 1. aria-label
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) {
    add(`[aria-label="${ariaLabel}"]`)
  }

  // 2. data-testid
  const testId = element.getAttribute('data-testid')
  if (testId) {
    add(`[data-testid="${testId}"]`)
  }

  // 3. Text content — short text only (long text is unreliable)
  const text = element.textContent?.trim()
  if (text && text.length > 0 && text.length <= 60) {
    const escaped = text.replace(/"/g, '\\"')
    add(`//*[contains(text(),"${escaped}")]`)
  }

  // 4. nth-child path from nearest ID'd ancestor
  add(buildNthChildPath(element))

  // 5. Tag + partial class match
  add(buildTagClassSelector(element))

  // 6. Role-based selector
  const role = element.getAttribute('role')
  if (role) {
    const label = ariaLabel ?? text?.slice(0, 40)
    if (label) {
      add(`[role="${role}"][aria-label="${label}"]`)
    }
  }

  return selectors
}
