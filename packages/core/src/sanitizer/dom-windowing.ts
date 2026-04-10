/**
 * DOM subtree windowing — extract a focused window of AccessNodes around
 * an interaction target to reduce token usage when sending DOM to the LLM.
 */

import type { AccessNode } from './dom-sanitizer.js'

// ─── Token estimation ────────────────────────────────────────────────────────

/** Rough token estimate: ~4 characters per token (GPT/Claude heuristic) */
const CHARS_PER_TOKEN = 4

/**
 * Estimate the number of LLM tokens a set of AccessNodes would consume
 * when serialized to text.
 */
export function estimateTokens(nodes: AccessNode[]): number {
  let charCount = 0
  for (const node of nodes) {
    // Account for role, name, selector, tag, and formatting overhead
    charCount += node.role.length + node.name.length + node.selector.length + node.tag.length + 20
  }
  return Math.ceil(charCount / CHARS_PER_TOKEN)
}

// ─── Keyword matching ────────────────────────────────────────────────────────

/** Extract meaningful keywords from a target hint string */
function extractKeywords(hint: string): string[] {
  // Lowercase, split on non-alphanumeric, filter short/stop words
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'on', 'in', 'to', 'for', 'of', 'and', 'or', 'with', 'that', 'this',
    'it', 'at', 'by', 'from', 'click', 'type', 'select', 'into', 'field', 'button',
  ])

  return hint
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
}

/** Score a node against target keywords. Higher = more relevant. */
function scoreNode(node: AccessNode, keywords: string[]): number {
  const haystack = `${node.name} ${node.role} ${node.tag} ${node.selector}`.toLowerCase()
  let score = 0
  for (const kw of keywords) {
    if (haystack.includes(kw)) score++
  }
  // Boost interactive nodes — they're more likely to be targets
  if (node.interactive) score += 0.5
  return score
}

// ─── Windowing ───────────────────────────────────────────────────────────────

/**
 * Given an array of AccessNodes and a target hint (from intent/step description),
 * find the most relevant node and return a window of `radius` nodes around it.
 *
 * The window preserves original ordering and always includes the best-matching node.
 * If no node matches the hint, returns the original array unchanged.
 */
export function windowAroundTarget(
  nodes: AccessNode[],
  targetHint: string,
  radius: number,
): AccessNode[] {
  if (nodes.length === 0 || !targetHint.trim()) return nodes

  const keywords = extractKeywords(targetHint)
  if (keywords.length === 0) return nodes

  // Score all nodes
  let bestIndex = -1
  let bestScore = 0

  for (let i = 0; i < nodes.length; i++) {
    const s = scoreNode(nodes[i], keywords)
    if (s > bestScore) {
      bestScore = s
      bestIndex = i
    }
  }

  // No meaningful match — return all nodes rather than a random window
  if (bestIndex === -1 || bestScore === 0) return nodes

  const start = Math.max(0, bestIndex - radius)
  const end = Math.min(nodes.length, bestIndex + radius + 1)

  return nodes.slice(start, end)
}

/**
 * Auto-size a window around the target to fit within a token budget.
 * Starts with a small radius and expands until the budget is exceeded or
 * all nodes are included.
 */
export function windowToTokenBudget(
  nodes: AccessNode[],
  targetHint: string,
  maxTokens: number,
): AccessNode[] {
  if (nodes.length === 0 || !targetHint.trim()) return nodes

  // If the full tree already fits, return it all
  if (estimateTokens(nodes) <= maxTokens) return nodes

  // Binary search for the largest radius that fits the budget
  let lo = 1
  let hi = nodes.length
  let bestWindow = nodes

  // Start with a minimal window
  const minWindow = windowAroundTarget(nodes, targetHint, 1)
  if (estimateTokens(minWindow) > maxTokens) {
    // Even the smallest window exceeds budget — return it anyway (best effort)
    return minWindow
  }

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const w = windowAroundTarget(nodes, targetHint, mid)
    const tokens = estimateTokens(w)

    if (tokens <= maxTokens) {
      bestWindow = w
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return bestWindow
}
