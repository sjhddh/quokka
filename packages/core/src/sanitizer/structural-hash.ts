/**
 * Structural fingerprint for DOM snapshots.
 * Used to invalidate plan cache when the page's interactive structure changes.
 *
 * Hash is intentionally coarse: it captures element roles, tags, and counts —
 * NOT text content, which changes too often and would cause spurious cache misses.
 */

import type { AccessNode } from './dom-sanitizer.js'

// ─── Deterministic string representation ──────────────────────────────────────

/**
 * Produce a canonical string that captures structural identity of a node list.
 *
 * Included:
 *  - role + tag for every node (order-preserved)
 *  - interactive flag
 *  - form field type breakdown (input/select/textarea counts)
 *
 * Excluded:
 *  - name / visible text (changes without structural change)
 *  - selector (fragile; changes with DOM mutations unrelated to structure)
 *  - visibility (visual state, not structural)
 */
function buildStructuralString(nodes: AccessNode[]): string {
  const parts: string[] = []

  let inputCount = 0
  let selectCount = 0
  let textareaCount = 0

  for (const node of nodes) {
    const interactive = node.interactive ? '1' : '0'
    parts.push(`${node.tag}:${node.role}:${interactive}`)

    if (node.tag === 'input') inputCount++
    else if (node.tag === 'select') selectCount++
    else if (node.tag === 'textarea') textareaCount++
  }

  // Append field-type summary so that adding/removing fields busts the hash
  parts.push(`inputs=${inputCount}`, `selects=${selectCount}`, `textareas=${textareaCount}`)

  return parts.join('|')
}

// ─── Hashing ──────────────────────────────────────────────────────────────────

/**
 * Simple djb2-style 32-bit hash — fast, no async, works everywhere.
 * Used as fallback when crypto.subtle is unavailable (Node.js without WebCrypto, JSDOM).
 */
function djb2Hash(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    // hash * 33 ^ charCode
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0 // keep unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * SHA-256 via crypto.subtle — returns hex string.
 * Available in modern browsers and Node.js 18+.
 */
async function sha256Async(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Synchronous structural hash.
 * Uses djb2 — appropriate for cache keys where collision resistance is not critical.
 * Call this from synchronous contexts (content scripts, render paths).
 */
export function computeStructuralHash(nodes: AccessNode[]): string {
  return djb2Hash(buildStructuralString(nodes))
}

/**
 * Async structural hash using SHA-256 via crypto.subtle.
 * Use when stronger collision resistance is needed (e.g. persisted cache keys).
 * Falls back to djb2 if crypto.subtle is unavailable.
 */
export async function computeStructuralHashAsync(nodes: AccessNode[]): Promise<string> {
  const canonical = buildStructuralString(nodes)

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      return await sha256Async(canonical)
    } catch {
      // Fall through to synchronous fallback
    }
  }

  return djb2Hash(canonical)
}
