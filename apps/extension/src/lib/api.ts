import type { Recipe, Run, QuokkaExport } from '@quokka/shared'

export interface ProviderConfig {
  id: string
  name: string
  type: 'openai-compatible' | 'mock'
  apiKey?: string
  baseUrl?: string
  model?: string
}

const BASE_URL = 'http://localhost:7749'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export function getRecipes(): Promise<Recipe[]> {
  return request('/api/recipes')
}

export function getRecipe(id: string): Promise<Recipe> {
  return request(`/api/recipes/${id}`)
}

export function createRecipe(recipe: Omit<Recipe, 'id'>): Promise<Recipe> {
  return request('/api/recipes', {
    method: 'POST',
    body: JSON.stringify(recipe),
  })
}

export function updateRecipe(id: string, recipe: Recipe): Promise<Recipe> {
  return request(`/api/recipes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(recipe),
  })
}

export function exportRecipe(id: string): Promise<QuokkaExport> {
  return request(`/api/recipes/${id}/export`)
}

export function importRecipe(recipe: unknown): Promise<Recipe> {
  return request('/api/recipes/import', {
    method: 'POST',
    body: JSON.stringify(recipe),
  })
}

export function exportAllRecipes(): Promise<QuokkaExport[]> {
  return request('/api/recipes/export/all')
}

export function createRun(recipeId: string, slotValues: Record<string, string>): Promise<Run> {
  return request('/api/runs', {
    method: 'POST',
    body: JSON.stringify({ recipeId, slotValues }),
  })
}

export function getRun(id: string): Promise<Run> {
  return request(`/api/runs/${id}`)
}

export interface CompileTracePayload {
  entries: Array<{
    type: string
    selector?: string
    value?: string
    url?: string
    timestamp: number
  }>
  url: string
}

export function compileTrace(trace: CompileTracePayload): Promise<Recipe> {
  return request('/api/compile', {
    method: 'POST',
    body: JSON.stringify(trace),
  })
}

export async function checkHealth(): Promise<boolean> {
  try {
    await fetch(`${BASE_URL}/api/health`)
    return true
  } catch {
    return false
  }
}

let _companionAvailableCache: { value: boolean; ts: number } | null = null
const COMPANION_CACHE_TTL = 30_000 // 30 seconds

/**
 * Cached companion health check. Re-checks at most every 30 seconds.
 * Call with `force: true` to bypass the cache.
 */
export async function isCompanionAvailable(force = false): Promise<boolean> {
  const now = Date.now()
  if (!force && _companionAvailableCache && now - _companionAvailableCache.ts < COMPANION_CACHE_TTL) {
    return _companionAvailableCache.value
  }
  const healthy = await checkHealth()
  _companionAvailableCache = { value: healthy, ts: now }
  return healthy
}

export function generateRecipe(prompt: string, providerId?: string): Promise<Recipe> {
  return request('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, providerId }),
  })
}

export function getProviders(): Promise<ProviderConfig[]> {
  return request('/api/providers')
}

export function createProvider(config: ProviderConfig): Promise<ProviderConfig> {
  return request('/api/providers', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

export function deleteProvider(id: string): Promise<void> {
  return request(`/api/providers/${id}`, {
    method: 'DELETE',
  })
}

export function getEventStreamUrl(runId: string): string {
  return `${BASE_URL}/api/runs/${runId}/events/stream`
}
