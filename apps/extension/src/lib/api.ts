import type { Recipe, Run } from '@quokka/shared'

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
    await fetch(`${BASE_URL}/health`)
    return true
  } catch {
    return false
  }
}
