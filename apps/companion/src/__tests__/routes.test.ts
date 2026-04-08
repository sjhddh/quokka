import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { createDb, RecipeRepo, RunRepo, EventRepo } from '@quokka/storage'
import type { Recipe } from '@quokka/shared'
import { recipesPlugin } from '../routes/recipes.js'
import { runsPlugin } from '../routes/runs.js'
import { compilePlugin } from '../routes/compile.js'
import { providersPlugin } from '../routes/providers.js'
import type { AppContext } from '../index.js'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  await app.register(cors, { origin: true })

  const db = createDb() // in-memory
  const ctx: AppContext = {
    recipeRepo: new RecipeRepo(db),
    runRepo: new RunRepo(db),
    eventRepo: new EventRepo(db),
  }
  app.decorate('ctx', ctx)

  await app.register(recipesPlugin)
  await app.register(runsPlugin)
  await app.register(compilePlugin)
  await app.register(providersPlugin)

  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })
})

describe('Recipe CRUD', () => {
  const sampleRecipe: Recipe = {
    id: 'test-recipe-1',
    name: 'Test Recipe',
    version: '0.1.0',
    hosts: ['example.com'],
    slots: [],
    guards: [],
    steps: [
      { type: 'navigate', url: 'https://example.com', description: 'Go to example' },
      { type: 'click', target: { css: '#btn' }, description: 'Click button' },
    ],
    meta: { createdFrom: 'code', tags: ['test'] },
  }

  it('POST /api/recipes — creates a recipe', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: sampleRecipe,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toBe('test-recipe-1')
    expect(body.name).toBe('Test Recipe')
  })

  it('GET /api/recipes — lists recipes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/recipes' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('test-recipe-1')
  })

  it('GET /api/recipes/:id — gets one recipe', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/recipes/test-recipe-1' })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Test Recipe')
  })

  it('GET /api/recipes/:id — 404 for missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/recipes/nope' })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /api/recipes/:id — updates a recipe', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/recipes/test-recipe-1',
      payload: { name: 'Updated Recipe' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Updated Recipe')
  })

  it('DELETE /api/recipes/:id — deletes a recipe', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/recipes/test-recipe-1' })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)

    const check = await app.inject({ method: 'GET', url: '/api/recipes/test-recipe-1' })
    expect(check.statusCode).toBe(404)
  })
})

describe('Runs', () => {
  let runId: string

  it('POST /api/runs — creates a run', async () => {
    // Create a recipe first
    await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: {
        id: 'r-for-run',
        name: 'Run Target',
        version: '0.1.0',
        hosts: ['example.com'],
        slots: [],
        guards: [],
        steps: [{ type: 'navigate', url: 'https://example.com' }],
        meta: { createdFrom: 'code', tags: [] },
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { recipeId: 'r-for-run', slotValues: { name: 'Alice' } },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.recipeId).toBe('r-for-run')
    expect(body.status).toBe('idle')
    expect(body.slotValues.name).toBe('Alice')
    runId = body.id
  })

  it('GET /api/runs/:id — gets a run', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/runs/${runId}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(runId)
  })

  it('PATCH /api/runs/:id — updates run status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/runs/${runId}`,
      payload: { status: 'running' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('running')
  })

  it('GET /api/runs/:id/events — returns empty events', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/runs/${runId}/events` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

describe('POST /api/compile', () => {
  it('compiles a trace into a recipe', async () => {
    const trace = [
      {
        action: 'navigate',
        selector: '',
        url: 'https://example.com/login',
        timestamp: 1000,
      },
      {
        action: 'type',
        selector: '#username',
        value: 'admin',
        url: 'https://example.com/login',
        timestamp: 2000,
      },
      {
        action: 'click',
        selector: '#submit-btn',
        url: 'https://example.com/login',
        timestamp: 3000,
      },
    ]

    const res = await app.inject({
      method: 'POST',
      url: '/api/compile',
      payload: { trace, name: 'Login Flow' },
    })
    expect(res.statusCode).toBe(200)
    const recipe = res.json()
    expect(recipe.name).toBe('Login Flow')
    expect(recipe.id).toBeDefined()
    expect(recipe.steps.length).toBeGreaterThanOrEqual(2)
    expect(recipe.hosts).toContain('example.com')
    expect(recipe.meta.createdFrom).toBe('watch')
  })
})
