import { describe, it, expect, beforeEach } from 'vitest'
import type { Recipe, Run, RunEvent, Pack } from '@quokka/shared'
import { createDb, type QuokkaDb } from '../db.js'
import { RecipeRepo } from '../repos/recipe-repo.js'
import { RunRepo } from '../repos/run-repo.js'
import { EventRepo } from '../repos/event-repo.js'
import { PackRepo } from '../repos/pack-repo.js'
import { ProviderRepo } from '../repos/provider-repo.js'

let db: QuokkaDb

beforeEach(() => {
  db = createDb()
})

const sampleRecipe: Recipe = {
  id: 'recipe-1',
  name: 'Login Flow',
  description: 'Logs into the app',
  version: '0.1.0',
  schemaVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: ['https://example.com'],
  slots: [{ key: 'username', label: 'Username', type: 'string' }],
  guards: [{ type: 'url', expect: 'https://example.com/dashboard', timeout: 5000 }],
  steps: [
    { type: 'navigate', url: 'https://example.com/login' },
    { type: 'type', target: { css: '#user' }, value: '{{username}}' },
    { type: 'click', target: { css: '#submit' } },
  ],
  meta: { createdFrom: 'code', tags: ['auth'] },
}

const sampleRun: Run = {
  id: 'run-1',
  recipeId: 'recipe-1',
  status: 'idle',
  slotValues: { username: 'alice' },
  currentStepIndex: 0,
  startedAt: '2026-01-01T00:00:00Z',
}

const sampleEvent: RunEvent = {
  id: 'evt-1',
  runId: 'run-1',
  type: 'run_started',
  timestamp: '2026-01-01T00:00:00Z',
  payload: { msg: 'go' },
}

const samplePack: Pack = {
  id: 'pack-1',
  name: 'Auth Pack',
  description: 'Authentication recipes',
  version: '1.0.0',
  recipeIds: ['recipe-1'],
}

describe('RecipeRepo', () => {
  it('creates and retrieves a recipe', () => {
    const repo = new RecipeRepo(db)
    repo.create(sampleRecipe)
    const found = repo.getById('recipe-1')
    expect(found).toBeDefined()
    expect(found!.name).toBe('Login Flow')
    expect(found!.hosts).toEqual(['https://example.com'])
    expect(found!.steps).toHaveLength(3)
  })

  it('lists all recipes', () => {
    const repo = new RecipeRepo(db)
    repo.create(sampleRecipe)
    repo.create({ ...sampleRecipe, id: 'recipe-2', name: 'Signup' })
    expect(repo.list()).toHaveLength(2)
  })

  it('updates a recipe', () => {
    const repo = new RecipeRepo(db)
    repo.create(sampleRecipe)
    const updated = repo.update('recipe-1', { name: 'Login Flow v2' })
    expect(updated!.name).toBe('Login Flow v2')
    expect(repo.getById('recipe-1')!.name).toBe('Login Flow v2')
  })

  it('deletes a recipe', () => {
    const repo = new RecipeRepo(db)
    repo.create(sampleRecipe)
    expect(repo.delete('recipe-1')).toBe(true)
    expect(repo.getById('recipe-1')).toBeUndefined()
  })

  it('returns undefined for missing recipe', () => {
    const repo = new RecipeRepo(db)
    expect(repo.getById('nope')).toBeUndefined()
  })
})

describe('RunRepo', () => {
  it('creates and retrieves a run', () => {
    const repo = new RunRepo(db)
    repo.create(sampleRun)
    const found = repo.getById('run-1')
    expect(found).toBeDefined()
    expect(found!.status).toBe('idle')
    expect(found!.slotValues).toEqual({ username: 'alice' })
  })

  it('lists runs by recipe', () => {
    const repo = new RunRepo(db)
    repo.create(sampleRun)
    repo.create({ ...sampleRun, id: 'run-2' })
    expect(repo.listByRecipe('recipe-1')).toHaveLength(2)
    expect(repo.listByRecipe('recipe-999')).toHaveLength(0)
  })

  it('updates run status', () => {
    const repo = new RunRepo(db)
    repo.create(sampleRun)
    const updated = repo.updateStatus('run-1', 'running', { currentStepIndex: 1 })
    expect(updated!.status).toBe('running')
    expect(updated!.currentStepIndex).toBe(1)
    expect(repo.getById('run-1')!.status).toBe('running')
  })
})

describe('EventRepo', () => {
  it('creates and lists events by run', () => {
    const repo = new EventRepo(db)
    repo.create(sampleEvent)
    repo.create({ ...sampleEvent, id: 'evt-2', type: 'step_started', stepIndex: 0 })
    const events = repo.listByRun('run-1')
    expect(events).toHaveLength(2)
    expect(events[0].type).toBe('run_started')
    expect(events[0].payload).toEqual({ msg: 'go' })
  })

  it('returns empty for unknown run', () => {
    const repo = new EventRepo(db)
    expect(repo.listByRun('nope')).toHaveLength(0)
  })
})

describe('PackRepo', () => {
  it('creates and retrieves a pack', () => {
    const repo = new PackRepo(db)
    repo.create(samplePack)
    const found = repo.getById('pack-1')
    expect(found).toBeDefined()
    expect(found!.name).toBe('Auth Pack')
    expect(found!.recipeIds).toEqual(['recipe-1'])
  })

  it('lists all packs', () => {
    const repo = new PackRepo(db)
    repo.create(samplePack)
    repo.create({ ...samplePack, id: 'pack-2', name: 'Nav Pack' })
    expect(repo.list()).toHaveLength(2)
  })
})

describe('ProviderRepo', () => {
  const sampleProvider = {
    id: 'prov-1',
    name: 'My OpenAI',
    type: 'openai-compatible' as const,
    apiKey: 'sk-test-123',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
  }

  it('creates and retrieves a provider', () => {
    const repo = new ProviderRepo(db)
    const created = repo.create(sampleProvider)
    expect(created.id).toBe('prov-1')
    expect(created.createdAt).toBeDefined()

    const found = repo.getById('prov-1')
    expect(found).toBeDefined()
    expect(found!.name).toBe('My OpenAI')
    expect(found!.type).toBe('openai-compatible')
    expect(found!.apiKey).toBe('sk-test-123')
    expect(found!.baseUrl).toBe('https://api.openai.com/v1')
    expect(found!.model).toBe('gpt-4')
  })

  it('lists all providers', () => {
    const repo = new ProviderRepo(db)
    repo.create(sampleProvider)
    repo.create({ ...sampleProvider, id: 'prov-2', name: 'Mock Provider', type: 'mock', apiKey: null, baseUrl: null, model: null })
    expect(repo.list()).toHaveLength(2)
  })

  it('updates provider fields', () => {
    const repo = new ProviderRepo(db)
    repo.create(sampleProvider)
    const updated = repo.update('prov-1', { name: 'Renamed', model: 'gpt-3.5-turbo' })
    expect(updated).toBeDefined()
    expect(updated!.name).toBe('Renamed')
    expect(updated!.model).toBe('gpt-3.5-turbo')
    expect(updated!.apiKey).toBe('sk-test-123') // unchanged

    const fetched = repo.getById('prov-1')
    expect(fetched!.name).toBe('Renamed')
    expect(fetched!.model).toBe('gpt-3.5-turbo')
  })

  it('deletes a provider', () => {
    const repo = new ProviderRepo(db)
    repo.create(sampleProvider)
    expect(repo.delete('prov-1')).toBe(true)
    expect(repo.getById('prov-1')).toBeUndefined()
  })

  it('returns undefined for missing provider', () => {
    const repo = new ProviderRepo(db)
    expect(repo.getById('nope')).toBeUndefined()
  })

  it('returns false when deleting non-existent provider', () => {
    const repo = new ProviderRepo(db)
    expect(repo.delete('nope')).toBe(false)
  })

  it('returns undefined when updating non-existent provider', () => {
    const repo = new ProviderRepo(db)
    expect(repo.update('nope', { name: 'x' })).toBeUndefined()
  })
})
