import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ExecutionPlanner, type ExecutionPlan, type PlannedAction } from '../planner/execution-planner.js'
import { PlanCache, MemoryPlanCacheStorage } from '../planner/plan-cache.js'
import type { ModelProvider } from '../providers/provider.js'
import type { PageSnapshot } from '../sanitizer/dom-sanitizer.js'
import type { IntentStep } from '../intent/intent-extractor.js'

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: 'https://example.com/page',
    title: 'Test Page',
    structuralHash: 'abc12345',
    accessibilityTree: [
      { role: 'textbox', name: 'Email', selector: '#email', visible: true, interactive: true, tag: 'input' },
      { role: 'textbox', name: 'Password', selector: '#pass', visible: true, interactive: true, tag: 'input' },
      { role: 'button', name: 'Sign In', selector: '#login-btn', visible: true, interactive: true, tag: 'button' },
    ],
    ...overrides,
  }
}

function makeStep(overrides: Partial<IntentStep> = {}): IntentStep {
  return {
    id: 'step_1',
    type: 'action',
    intent: 'Click the Sign In button',
    context_hint: 'primary submit button',
    likelyNavigates: true,
    ...overrides,
  }
}

function makePlannedAction(overrides: Partial<PlannedAction> = {}): PlannedAction {
  return {
    stepId: 'step_1',
    action: 'click',
    selector: '#login-btn',
    confidence: 0.95,
    reasoning: 'Matched by id',
    ...overrides,
  }
}

class TestModelProvider implements ModelProvider {
  responses: string[] = []
  callCount = 0

  constructor(responses?: string[]) {
    this.responses = responses ?? []
  }

  async complete(
    _prompt: string,
    _options?: { system?: string; temperature?: number }
  ): Promise<string> {
    const response = this.responses[this.callCount] ?? this.responses[this.responses.length - 1] ?? ''
    this.callCount++
    return response
  }
}

// ─── ExecutionPlanner.planPage ────────────────────────────────────────────────

describe('ExecutionPlanner.planPage', () => {
  it('returns an empty plan when no steps are provided', async () => {
    const provider = new TestModelProvider([])
    const planner = new ExecutionPlanner(provider)
    const snapshot = makeSnapshot()

    const plan = await planner.planPage([], snapshot)

    expect(plan.actions).toEqual([])
    expect(plan.pageUrl).toBe(snapshot.url)
    expect(plan.structuralHash).toBe(snapshot.structuralHash)
    expect(provider.callCount).toBe(0)
  })

  it('parses a valid LLM response into a plan', async () => {
    const llmResponse = JSON.stringify([
      {
        stepId: 'step_1',
        action: 'click',
        selector: '#login-btn',
        confidence: 0.95,
        reasoning: 'Button with id login-btn matches Sign In',
      },
    ])
    const provider = new TestModelProvider([llmResponse])
    const planner = new ExecutionPlanner(provider)

    const plan = await planner.planPage([makeStep()], makeSnapshot())

    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0].selector).toBe('#login-btn')
    expect(plan.actions[0].confidence).toBe(0.95)
    expect(plan.createdAt).toBeGreaterThan(0)
  })

  it('handles multi-step planning', async () => {
    const llmResponse = JSON.stringify([
      { stepId: 'step_1', action: 'type', selector: '#email', value: 'test@example.com', confidence: 0.9, reasoning: 'Email input' },
      { stepId: 'step_2', action: 'type', selector: '#pass', value: '{{credential_1}}', confidence: 0.9, reasoning: 'Password input' },
      { stepId: 'step_3', action: 'click', selector: '#login-btn', confidence: 0.95, reasoning: 'Submit button' },
    ])
    const provider = new TestModelProvider([llmResponse])
    const planner = new ExecutionPlanner(provider)

    const steps = [
      makeStep({ id: 'step_1', intent: 'Enter email' }),
      makeStep({ id: 'step_2', intent: 'Enter password' }),
      makeStep({ id: 'step_3', intent: 'Click Sign In' }),
    ]

    const plan = await planner.planPage(steps, makeSnapshot())
    expect(plan.actions).toHaveLength(3)
  })

  it('throws when LLM returns no valid actions', async () => {
    const provider = new TestModelProvider(['totally not json'])
    const planner = new ExecutionPlanner(provider)

    await expect(
      planner.planPage([makeStep()], makeSnapshot())
    ).rejects.toThrow('no valid actions')
  })

  it('throws when LLM call itself fails', async () => {
    const provider: ModelProvider = {
      async complete() {
        throw new Error('API rate limited')
      },
    }
    const planner = new ExecutionPlanner(provider)

    await expect(
      planner.planPage([makeStep()], makeSnapshot())
    ).rejects.toThrow('LLM call failed')
  })

  it('clamps confidence to [0, 1]', async () => {
    const llmResponse = JSON.stringify([
      { stepId: 'step_1', action: 'click', selector: '#btn', confidence: 5.0, reasoning: 'overconfident' },
    ])
    const provider = new TestModelProvider([llmResponse])
    const planner = new ExecutionPlanner(provider)

    const plan = await planner.planPage([makeStep()], makeSnapshot())
    expect(plan.actions[0].confidence).toBeLessThanOrEqual(1)
    expect(plan.actions[0].confidence).toBeGreaterThanOrEqual(0)
  })
})

// ─── ExecutionPlanner.handleFailure ──────────────────────────────────────────

describe('ExecutionPlanner.handleFailure', () => {
  it('returns a new action with a different selector', async () => {
    const recoveryResponse = JSON.stringify([
      {
        stepId: 'step_1',
        action: 'click',
        selector: '[aria-label="Sign In"]',
        confidence: 0.8,
        reasoning: 'Alternative selector via aria-label',
      },
    ])
    const provider = new TestModelProvider([recoveryResponse])
    const planner = new ExecutionPlanner(provider)

    const failed = makePlannedAction({ selector: '#login-btn' })
    const recovered = await planner.handleFailure(
      failed,
      'Element not found: #login-btn',
      makeSnapshot(),
      makeStep(),
    )

    expect(recovered.selector).toBe('[aria-label="Sign In"]')
    expect(recovered.selector).not.toBe(failed.selector)
  })

  it('throws when recovery proposes the same failed selector', async () => {
    const recoveryResponse = JSON.stringify([
      {
        stepId: 'step_1',
        action: 'click',
        selector: '#login-btn',  // same as the one that failed
        confidence: 0.7,
        reasoning: 'retrying same',
      },
    ])
    const provider = new TestModelProvider([recoveryResponse])
    const planner = new ExecutionPlanner(provider)

    const failed = makePlannedAction({ selector: '#login-btn' })

    await expect(
      planner.handleFailure(failed, 'not found', makeSnapshot(), makeStep())
    ).rejects.toThrow('same selector that already failed')
  })

  it('throws when recovery proposes a previously-tried fallback selector', async () => {
    const recoveryResponse = JSON.stringify([
      {
        stepId: 'step_1',
        action: 'click',
        selector: '.fallback-btn',  // in the failed action's fallbackSelectors
        confidence: 0.7,
        reasoning: 'retrying fallback',
      },
    ])
    const provider = new TestModelProvider([recoveryResponse])
    const planner = new ExecutionPlanner(provider)

    const failed = makePlannedAction({
      selector: '#login-btn',
      fallbackSelectors: ['.fallback-btn', '.other-btn'],
    })

    await expect(
      planner.handleFailure(failed, 'not found', makeSnapshot(), makeStep())
    ).rejects.toThrow('same selector that already failed')
  })

  it('throws when recovery LLM call fails', async () => {
    const provider: ModelProvider = {
      async complete() {
        throw new Error('timeout')
      },
    }
    const planner = new ExecutionPlanner(provider)

    await expect(
      planner.handleFailure(makePlannedAction(), 'error', makeSnapshot(), makeStep())
    ).rejects.toThrow('recovery LLM call failed')
  })
})

// ─── PlanCache ───────────────────────────────────────────────────────────────

describe('PlanCache', () => {
  let storage: MemoryPlanCacheStorage
  let cache: PlanCache

  function makePlan(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
    return {
      pageUrl: 'https://example.com/page',
      structuralHash: 'abc12345',
      actions: [makePlannedAction()],
      createdAt: Date.now(),
      ...overrides,
    }
  }

  beforeEach(() => {
    storage = new MemoryPlanCacheStorage()
    cache = new PlanCache(storage)
  })

  it('returns null for cache miss', async () => {
    const result = await cache.get('https://example.com/page', 'abc12345')
    expect(result).toBeNull()
  })

  it('stores and retrieves a plan (cache hit)', async () => {
    const plan = makePlan()
    await cache.set(plan)
    const result = await cache.get(plan.pageUrl, plan.structuralHash)
    expect(result).not.toBeNull()
    expect(result!.actions).toHaveLength(1)
    expect(result!.actions[0].selector).toBe('#login-btn')
  })

  it('returns null when structural hash does not match', async () => {
    const plan = makePlan({ structuralHash: 'hash_v1' })
    await cache.set(plan)

    const result = await cache.get(plan.pageUrl, 'hash_v2')
    expect(result).toBeNull()
  })

  it('returns null when entry has expired (TTL)', async () => {
    const plan = makePlan()
    await cache.set(plan)

    // Manually expire the entry by backdating cachedAt
    const keys = await storage.keys()
    const entry = await storage.get(keys[0])
    if (entry) {
      entry.cachedAt = Date.now() - 25 * 60 * 60 * 1000  // 25 hours ago (> 24h default TTL)
      await storage.set(keys[0], entry)
    }

    const result = await cache.get(plan.pageUrl, plan.structuralHash)
    expect(result).toBeNull()
  })

  it('uses extended TTL for high-confidence entries (hitCount >= 5)', async () => {
    const plan = makePlan()
    await cache.set(plan)

    // Promote entry to high-confidence by setting hitCount
    const keys = await storage.keys()
    const entry = await storage.get(keys[0])
    if (entry) {
      entry.hitCount = 6
      // Set cachedAt to 3 days ago — exceeds default 24h but within confident 7d
      entry.cachedAt = Date.now() - 3 * 24 * 60 * 60 * 1000
      await storage.set(keys[0], entry)
    }

    const result = await cache.get(plan.pageUrl, plan.structuralHash)
    expect(result).not.toBeNull()
  })

  it('expires even high-confidence entries after 7 days', async () => {
    const plan = makePlan()
    await cache.set(plan)

    const keys = await storage.keys()
    const entry = await storage.get(keys[0])
    if (entry) {
      entry.hitCount = 10
      entry.cachedAt = Date.now() - 8 * 24 * 60 * 60 * 1000  // 8 days ago
      await storage.set(keys[0], entry)
    }

    const result = await cache.get(plan.pageUrl, plan.structuralHash)
    expect(result).toBeNull()
  })
})

// ─── PlanCache.updateConfidence ──────────────────────────────────────────────

describe('PlanCache.updateConfidence', () => {
  let storage: MemoryPlanCacheStorage
  let cache: PlanCache

  function makePlan(): ExecutionPlan {
    return {
      pageUrl: 'https://example.com/page',
      structuralHash: 'abc12345',
      actions: [makePlannedAction()],
      createdAt: Date.now(),
    }
  }

  beforeEach(() => {
    storage = new MemoryPlanCacheStorage()
    cache = new PlanCache(storage)
  })

  it('initialises confidence at neutral (0.5) and moves toward 1.0 on success', async () => {
    await cache.set(makePlan())
    await cache.updateConfidence('https://example.com/page', '#login-btn', true)

    const keys = await storage.keys()
    const entry = await storage.get(keys[0])

    // EMA: 0.3 * 1.0 + 0.7 * 0.5 = 0.65
    expect(entry!.selectorConfidence['#login-btn']).toBeCloseTo(0.65, 5)
  })

  it('moves confidence toward 0.0 on failure', async () => {
    await cache.set(makePlan())
    await cache.updateConfidence('https://example.com/page', '#login-btn', false)

    const keys = await storage.keys()
    const entry = await storage.get(keys[0])

    // EMA: 0.3 * 0.0 + 0.7 * 0.5 = 0.35
    expect(entry!.selectorConfidence['#login-btn']).toBeCloseTo(0.35, 5)
  })

  it('accumulates multiple success updates', async () => {
    await cache.set(makePlan())

    // Three consecutive successes
    await cache.updateConfidence('https://example.com/page', '#login-btn', true)
    await cache.updateConfidence('https://example.com/page', '#login-btn', true)
    await cache.updateConfidence('https://example.com/page', '#login-btn', true)

    const keys = await storage.keys()
    const entry = await storage.get(keys[0])

    // Each success: new = 0.3 * 1.0 + 0.7 * prev
    // Step 1: 0.3 + 0.35 = 0.65
    // Step 2: 0.3 + 0.455 = 0.755
    // Step 3: 0.3 + 0.5285 = 0.8285
    expect(entry!.selectorConfidence['#login-btn']).toBeCloseTo(0.8285, 3)
  })

  it('increments hitCount on success', async () => {
    await cache.set(makePlan())

    await cache.updateConfidence('https://example.com/page', '#login-btn', true)
    await cache.updateConfidence('https://example.com/page', '#login-btn', true)

    const keys = await storage.keys()
    const entry = await storage.get(keys[0])
    expect(entry!.hitCount).toBe(2)
  })

  it('does not increment hitCount on failure', async () => {
    await cache.set(makePlan())

    await cache.updateConfidence('https://example.com/page', '#login-btn', false)

    const keys = await storage.keys()
    const entry = await storage.get(keys[0])
    expect(entry!.hitCount).toBe(0)
  })
})

// ─── PlanCache.prune ─────────────────────────────────────────────────────────

describe('PlanCache.prune', () => {
  let storage: MemoryPlanCacheStorage
  let cache: PlanCache

  beforeEach(() => {
    storage = new MemoryPlanCacheStorage()
    cache = new PlanCache(storage)
  })

  it('removes expired entries', async () => {
    const plan: ExecutionPlan = {
      pageUrl: 'https://example.com/old',
      structuralHash: 'old123',
      actions: [makePlannedAction()],
      createdAt: Date.now(),
    }
    await cache.set(plan)

    // Expire it
    const keys = await storage.keys()
    const entry = await storage.get(keys[0])
    if (entry) {
      entry.cachedAt = Date.now() - 25 * 60 * 60 * 1000  // 25h
      await storage.set(keys[0], entry)
    }

    const removed = await cache.prune()
    expect(removed).toBe(1)
    expect(await storage.keys()).toHaveLength(0)
  })

  it('removes entries where all selector confidences are below threshold', async () => {
    const plan: ExecutionPlan = {
      pageUrl: 'https://example.com/broken',
      structuralHash: 'broken123',
      actions: [makePlannedAction()],
      createdAt: Date.now(),
    }
    await cache.set(plan)

    // Set all confidences below 0.2
    const keys = await storage.keys()
    const entry = await storage.get(keys[0])
    if (entry) {
      entry.selectorConfidence = { '#login-btn': 0.1, '#other': 0.05 }
      await storage.set(keys[0], entry)
    }

    const removed = await cache.prune()
    expect(removed).toBe(1)
  })

  it('keeps valid non-expired entries with acceptable confidence', async () => {
    const plan: ExecutionPlan = {
      pageUrl: 'https://example.com/good',
      structuralHash: 'good123',
      actions: [makePlannedAction()],
      createdAt: Date.now(),
    }
    await cache.set(plan)

    const removed = await cache.prune()
    expect(removed).toBe(0)
    expect(await storage.keys()).toHaveLength(1)
  })

  it('keeps entries with no selector confidence data (empty object)', async () => {
    const plan: ExecutionPlan = {
      pageUrl: 'https://example.com/new',
      structuralHash: 'new123',
      actions: [makePlannedAction()],
      createdAt: Date.now(),
    }
    await cache.set(plan)

    // selectorConfidence is {} by default — should not be pruned
    const removed = await cache.prune()
    expect(removed).toBe(0)
  })
})

// ─── MemoryPlanCacheStorage ──────────────────────────────────────────────────

describe('MemoryPlanCacheStorage', () => {
  it('implements basic CRUD operations', async () => {
    const store = new MemoryPlanCacheStorage()

    // Initially empty
    expect(await store.keys()).toEqual([])
    expect(await store.get('nonexistent')).toBeNull()

    // Set and get
    const entry = {
      pageUrl: 'https://test.com',
      structuralHash: 'h1',
      plan: { pageUrl: 'https://test.com', structuralHash: 'h1', actions: [], createdAt: Date.now() },
      selectorConfidence: {},
      cachedAt: Date.now(),
      ttlFloor: Date.now() + 86400000,
      hitCount: 0,
    }
    await store.set('key1', entry)
    expect(await store.get('key1')).toEqual(entry)
    expect(await store.keys()).toEqual(['key1'])

    // Delete
    await store.delete('key1')
    expect(await store.get('key1')).toBeNull()
    expect(await store.keys()).toEqual([])
  })
})
