import type { WatchTrace } from './types.js'

/**
 * Remove consecutive duplicate clicks on the same selector and
 * collapse rapid sequential type events into one (merging values).
 */
export function deduplicateTrace(trace: WatchTrace): WatchTrace {
  if (trace.length === 0) return []

  const result: WatchTrace = []

  for (let i = 0; i < trace.length; i++) {
    const entry = trace[i]

    // Skip consecutive duplicate clicks on the same selector
    if (
      entry.action === 'click' &&
      result.length > 0 &&
      result[result.length - 1].action === 'click' &&
      result[result.length - 1].selector === entry.selector
    ) {
      continue
    }

    // Collapse sequential type events on the same selector
    if (
      entry.action === 'type' &&
      result.length > 0 &&
      result[result.length - 1].action === 'type' &&
      result[result.length - 1].selector === entry.selector
    ) {
      const prev = result[result.length - 1]
      prev.value = (prev.value ?? '') + (entry.value ?? '')
      prev.timestamp = entry.timestamp
      continue
    }

    result.push({ ...entry })
  }

  return result
}
