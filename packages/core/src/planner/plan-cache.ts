import type { ExecutionPlan } from './execution-planner.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanCacheEntry {
  pageUrl: string
  structuralHash: string
  plan: ExecutionPlan
  /**
   * Per-selector success confidence tracked as an Exponential Moving Average.
   * Key: CSS selector string. Value: EMA in [0, 1].
   */
  selectorConfidence: Record<string, number>
  cachedAt: number
  /**
   * Minimum age (ms) before this entry is eligible for pruning.
   * Entries that have been verified reliable get a higher floor.
   */
  ttlFloor: number
  hitCount: number
}

/**
 * Storage backend interface — decoupled so the extension can use IndexedDB
 * and the CLI/headless runner can use SQLite or an in-memory Map.
 */
export interface PlanCacheStorage {
  get(key: string): Promise<PlanCacheEntry | null>
  set(key: string, entry: PlanCacheEntry): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default TTL for a cached plan: 24 hours */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

/** Minimum TTL for a highly-confident plan (many successful hits): 7 days */
const CONFIDENT_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Hit count threshold to promote a plan to the longer TTL */
const CONFIDENT_HIT_THRESHOLD = 5

/** EMA alpha — how much weight to give the latest observation (0.3 = 30%) */
const EMA_ALPHA = 0.3

/** Confidence floor below which a selector is considered unreliable */
const CONFIDENCE_EVICT_THRESHOLD = 0.2

// ─── Cache key ────────────────────────────────────────────────────────────────

/**
 * Primary cache key is the structural hash — plans are keyed by DOM structure,
 * not by URL alone. URL is stored for diagnostics and secondary invalidation.
 */
function makeCacheKey(pageUrl: string, structuralHash: string): string {
  // Include a URL prefix to prevent collisions across different pages that happen
  // to share a hash (vanishingly unlikely but defensive)
  try {
    const host = new URL(pageUrl).hostname
    return `${host}:${structuralHash}`
  } catch {
    return `unknown:${structuralHash}`
  }
}

// ─── PlanCache ────────────────────────────────────────────────────────────────

export class PlanCache {
  constructor(private storage: PlanCacheStorage) {}

  /**
   * Return a cached plan if the structural hash matches and the entry hasn't expired.
   * Returns null on any mismatch, expiry, or storage error.
   */
  async get(pageUrl: string, currentHash: string): Promise<ExecutionPlan | null> {
    const key = makeCacheKey(pageUrl, currentHash)

    let entry: PlanCacheEntry | null
    try {
      entry = await this.storage.get(key)
    } catch (err) {
      console.warn(`[PlanCache] storage.get error: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }

    if (!entry) return null

    // Structural hash mismatch — DOM has changed, plan is stale
    if (entry.structuralHash !== currentHash) return null

    // TTL check
    const age = Date.now() - entry.cachedAt
    const ttl = entry.hitCount >= CONFIDENT_HIT_THRESHOLD ? CONFIDENT_TTL_MS : DEFAULT_TTL_MS
    if (age > ttl) return null

    return entry.plan
  }

  /**
   * Store a plan. Creates a new entry with default confidence values.
   */
  async set(plan: ExecutionPlan): Promise<void> {
    const key = makeCacheKey(plan.pageUrl, plan.structuralHash)

    // Preserve existing confidence data if we're refreshing an existing entry
    let existing: PlanCacheEntry | null = null
    try {
      existing = await this.storage.get(key)
    } catch {
      // Ignore — we'll create a fresh entry
    }

    const entry: PlanCacheEntry = {
      pageUrl: plan.pageUrl,
      structuralHash: plan.structuralHash,
      plan,
      selectorConfidence: existing?.selectorConfidence ?? {},
      cachedAt: Date.now(),
      ttlFloor: Date.now() + DEFAULT_TTL_MS,
      hitCount: existing?.hitCount ?? 0,
    }

    try {
      await this.storage.set(key, entry)
    } catch (err) {
      console.warn(`[PlanCache] storage.set error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * Update selector confidence after execution using an EMA.
   *
   * succeeded=true  pushes confidence toward 1.0
   * succeeded=false pushes confidence toward 0.0
   *
   * Also increments the hit counter so reliable plans get promoted to longer TTL.
   */
  async updateConfidence(pageUrl: string, selector: string, succeeded: boolean): Promise<void> {
    // We need to find the entry — iterate keys to locate by URL prefix since we
    // don't have the hash at call time. For the common case this is a single entry.
    let keys: string[]
    try {
      keys = await this.storage.keys()
    } catch (err) {
      console.warn(`[PlanCache] storage.keys error: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    let hostname: string
    try {
      hostname = new URL(pageUrl).hostname
    } catch {
      hostname = 'unknown'
    }

    const matching = keys.filter(k => k.startsWith(`${hostname}:`))

    for (const key of matching) {
      let entry: PlanCacheEntry | null
      try {
        entry = await this.storage.get(key)
      } catch {
        continue
      }
      if (!entry || entry.pageUrl !== pageUrl) continue

      // EMA update: new = alpha * observation + (1 - alpha) * old
      const prev = entry.selectorConfidence[selector] ?? 0.5  // start at neutral
      const observation = succeeded ? 1.0 : 0.0
      entry.selectorConfidence[selector] = EMA_ALPHA * observation + (1 - EMA_ALPHA) * prev

      if (succeeded) {
        entry.hitCount += 1
      }

      try {
        await this.storage.set(key, entry)
      } catch (err) {
        console.warn(`[PlanCache] confidence update write error: ${err instanceof Error ? err.message : String(err)}`)
      }

      // Only update the first matching entry (one plan per page/hash)
      break
    }
  }

  /**
   * Remove expired entries and entries with universally low selector confidence.
   * Returns the number of entries removed.
   */
  async prune(): Promise<number> {
    let keys: string[]
    try {
      keys = await this.storage.keys()
    } catch (err) {
      console.warn(`[PlanCache] prune storage.keys error: ${err instanceof Error ? err.message : String(err)}`)
      return 0
    }

    let removed = 0
    const now = Date.now()

    for (const key of keys) {
      let entry: PlanCacheEntry | null
      try {
        entry = await this.storage.get(key)
      } catch {
        continue
      }
      if (!entry) continue

      const age = now - entry.cachedAt
      const ttl = entry.hitCount >= CONFIDENT_HIT_THRESHOLD ? CONFIDENT_TTL_MS : DEFAULT_TTL_MS

      // Expired
      if (age > ttl) {
        await this.storage.delete(key)
        removed++
        continue
      }

      // All selectors in this plan have collapsed to near-zero confidence
      // (means the page has likely changed structurally even if hash matched)
      const confidences = Object.values(entry.selectorConfidence)
      if (
        confidences.length > 0 &&
        confidences.every(c => c < CONFIDENCE_EVICT_THRESHOLD)
      ) {
        await this.storage.delete(key)
        removed++
      }
    }

    return removed
  }
}

// ─── In-memory storage (for testing and CLI use) ──────────────────────────────

/**
 * Simple in-memory PlanCacheStorage implementation.
 * Use this for unit tests or the CLI headless runner.
 * The extension should provide an IndexedDB-backed implementation.
 */
export class MemoryPlanCacheStorage implements PlanCacheStorage {
  private store = new Map<string, PlanCacheEntry>()

  async get(key: string): Promise<PlanCacheEntry | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, entry: PlanCacheEntry): Promise<void> {
    this.store.set(key, entry)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys())
  }
}
