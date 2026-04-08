import type { TraceEntry } from './types.js'

/**
 * Refine a selector using heuristics:
 * - Prefer data-testid attributes
 * - Prefer #id selectors
 * - Prefer [aria-label] over long positional selectors
 * - Clean up overly specific paths
 */
export function refineSelector(selector: string, entry: TraceEntry): string {
  // If selector already uses data-testid, keep it
  if (selector.includes('[data-testid=')) {
    const match = selector.match(/\[data-testid=["']?([^"'\]]+)["']?\]/)
    if (match) {
      return `[data-testid="${match[1]}"]`
    }
  }

  // If selector is an #id, keep it clean
  if (selector.match(/^#[\w-]+$/)) {
    return selector
  }

  // If selector contains an #id somewhere, extract it
  const idMatch = selector.match(/#([\w-]+)/)
  if (idMatch) {
    return `#${idMatch[1]}`
  }

  // If entry has aria-label info in textContent, prefer that
  const ariaMatch = selector.match(/\[aria-label=["']?([^"'\]]+)["']?\]/)
  if (ariaMatch) {
    return `[aria-label="${ariaMatch[1]}"]`
  }

  // Clean up overly specific positional selectors (more than 3 levels deep with nth-child)
  const nthChildCount = (selector.match(/:nth-child/g) || []).length
  if (nthChildCount > 2) {
    // Try to simplify: keep the last meaningful part
    const parts = selector.split(' > ')
    const meaningful = parts.filter(
      (p) =>
        p.includes('#') ||
        p.includes('[data-testid') ||
        p.includes('[aria-label') ||
        p.match(/^[a-z]+$/i),
    )
    if (meaningful.length > 0) {
      return meaningful[meaningful.length - 1]
    }
    // Fallback: keep last two segments
    if (parts.length > 2) {
      return parts.slice(-2).join(' > ')
    }
  }

  // If we have a tagName from the entry, prefer tag + simple selector
  if (entry.tagName) {
    const tag = entry.tagName.toLowerCase()
    if (selector.includes(tag) && selector.length > 50) {
      // Selector is long; simplify to just the tag-based part
      const tagPart = selector
        .split(' ')
        .find((p) => p.startsWith(tag))
      if (tagPart) return tagPart
    }
  }

  return selector
}
