import type { Locator } from '@quokka/shared'

/** Escape an ID for use in a CSS selector. Uses CSS.escape when available, else simple fallback. */
function escapeCssId(id: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return escapeCssId(id)
  return id.replace(/([^\w-])/g, '\\$1')
}

/**
 * Given a Locator, produce an ordered list of CSS selectors to try.
 *
 * Chain priority:
 *   1. CSS selector
 *   2. ID-based selector
 *   3. data-testid
 *   4. aria-label
 *   5. Text content
 *   6. Explicit fallbackSelectors from the locator (captured during recording)
 *   7. nth-child path (from locator.nthChildPath if available)
 */
export function buildSelectorChain(locator: Locator): string[] {
  const selectors: string[] = []
  const seen = new Set<string>()

  function add(s: string | undefined) {
    if (s && !seen.has(s)) {
      seen.add(s)
      selectors.push(s)
    }
  }

  // 1. CSS selector
  add(locator.css)

  // 2. ID-based selector (extract from css if it's an ID selector, or from explicit id)
  if (locator.css && locator.css.startsWith('#') && !locator.css.includes(' ')) {
    // Already added as CSS above
  }

  // 3. data-testid
  if (locator.testId) add(`[data-testid="${locator.testId}"]`)

  // 4. aria-label
  if (locator.ariaLabel) add(`[aria-label="${locator.ariaLabel}"]`)

  // 5. Text content
  if (locator.text) add(`:has-text("${locator.text}")`)

  // 6. Explicit fallbacks captured during recording
  if (locator.fallbackSelectors) {
    for (const fb of locator.fallbackSelectors) {
      add(fb)
    }
  }

  // 7. Cross-strategy alternatives from locator fields
  if (locator.ariaLabel && locator.css) {
    add(`[aria-label="${locator.ariaLabel}"]`)
  }
  if (locator.text && locator.css) {
    add(`:has-text("${locator.text}")`)
  }

  return selectors
}

/**
 * Build an nth-child path from an element up to the nearest ancestor with an ID,
 * or up to the document body if no ID'd ancestor exists.
 *
 * Returns a selector like `#ancestor > div:nth-child(2) > span:nth-child(1)`
 * that uniquely identifies the element's position in the DOM tree.
 */
export function buildNthChildPath(element: Element): string {
  const parts: string[] = []
  let current: Element | null = element

  while (current && current !== document.documentElement && current !== document.body) {
    const tag = current.tagName.toLowerCase()

    // If this element has an ID, use it as the anchor and stop
    if (current.id) {
      parts.unshift(`#${escapeCssId(current.id)}`)
      return parts.join(' > ')
    }

    // Compute nth-child index (1-based, among all siblings)
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

  // No ID'd ancestor found — anchor from body
  if (parts.length > 0) {
    parts.unshift('body')
  }

  return parts.join(' > ')
}

/**
 * Build a combined tag + partial class selector.
 * E.g. `button[class*="submit"]` — picks the most distinctive class token.
 */
export function buildCombinedSelector(element: Element): string | null {
  const tag = element.tagName.toLowerCase()
  const classList = Array.from(element.classList)

  if (classList.length === 0) return null

  // Pick the longest class name as most likely to be distinctive
  const bestClass = classList.reduce((a, b) => (a.length >= b.length ? a : b))

  return `${tag}[class*="${bestClass}"]`
}

/**
 * Build a parent-child chain selector.
 * E.g. `.parent > button:nth-child(2)` — uses parent's class/id + child position.
 */
export function buildParentChildSelector(element: Element): string | null {
  const parent = element.parentElement
  if (!parent || parent === document.body || parent === document.documentElement) return null

  const tag = element.tagName.toLowerCase()
  const children = Array.from(parent.children)
  const sameTag = children.filter(c => c.tagName === element.tagName)
  const index = sameTag.indexOf(element) + 1

  let parentSelector: string
  if (parent.id) {
    parentSelector = `#${escapeCssId(parent.id)}`
  } else if (parent.classList.length > 0) {
    parentSelector = `${parent.tagName.toLowerCase()}.${Array.from(parent.classList).join('.')}`
  } else {
    return null
  }

  const childPart = sameTag.length > 1 ? `${tag}:nth-of-type(${index})` : tag

  return `${parentSelector} > ${childPart}`
}
