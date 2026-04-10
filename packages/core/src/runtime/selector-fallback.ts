import type { Locator } from '@quokka/shared'

/**
 * Given a Locator, produce an ordered list of CSS selectors to try.
 *
 * Order of priority:
 *   1. Primary resolved selector (css / testId / ariaLabel / text)
 *   2. Explicit fallbackSelectors from the locator (captured during recording)
 *   3. Generated alternatives derived from the locator fields
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

  // 1. Primary selector strategies
  add(locator.css)
  if (locator.testId) add(`[data-testid="${locator.testId}"]`)
  if (locator.ariaLabel) add(`[aria-label="${locator.ariaLabel}"]`)
  if (locator.text) add(`:has-text("${locator.text}")`)

  // 2. Explicit fallbacks captured during recording
  if (locator.fallbackSelectors) {
    for (const fb of locator.fallbackSelectors) {
      add(fb)
    }
  }

  // 3. Generated cross-strategy alternatives from locator fields
  //    If the primary was CSS, also try aria-label / text if available
  if (locator.ariaLabel && locator.css) {
    add(`[aria-label="${locator.ariaLabel}"]`)
  }
  if (locator.text && locator.css) {
    add(`:has-text("${locator.text}")`)
  }

  return selectors
}
