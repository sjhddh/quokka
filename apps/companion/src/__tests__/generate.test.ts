import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { createDb, RecipeRepo, RunRepo, EventRepo, ProviderRepo } from '@quokka/storage'
import { ModelRouter } from '@quokka/model-router'
import { recipesPlugin } from '../routes/recipes.js'
import { runsPlugin } from '../routes/runs.js'
import { compilePlugin } from '../routes/compile.js'
import { providersPlugin } from '../routes/providers.js'
import { generatePlugin } from '../routes/generate.js'
import type { AppContext } from '../index.js'

const VALID_RECIPE_JSON = JSON.stringify({
  name: 'Login to Example',
  description: 'Automates login flow',
  version: '0.1.0',
  hosts: ['example.com'],
  slots: [
    { key: 'username', label: 'Username', type: 'string' },
  ],
  guards: [],
  steps: [
    { type: 'navigate', url: 'https://example.com/login', description: 'Open login' },
    { type: 'type', target: { css: '#user' }, value: '{{username}}', description: 'Enter username' },
    { type: 'click', target: { css: '#submit' }, description: 'Submit' },
  ],
  meta: { createdFrom: 'prompt', tags: ['login'] },
})

/** Creates a fake ModelRouter-like object whose provider returns the given string */
function fakeRouter(response: string) {
  return {
    route(_providerId?: string) {
      return {
        async complete(_prompt: string, _options?: { system?: string; temperature?: number }) {
          return response
        },
      }
    },
  } as unknown as ModelRouter
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  await app.register(cors, { origin: true })

  const db = createDb()
  const ctx: AppContext = {
    recipeRepo: new RecipeRepo(db),
    runRepo: new RunRepo(db),
    eventRepo: new EventRepo(db),
    providerRepo: new ProviderRepo(db),
    modelRouter: fakeRouter(VALID_RECIPE_JSON),
  }
  app.decorate('ctx', ctx)

  await app.register(recipesPlugin)
  await app.register(runsPlugin)
  await app.register(compilePlugin)
  await app.register(providersPlugin)
  await app.register(generatePlugin)

  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('POST /api/generate', () => {
  it('returns a valid Recipe when LLM outputs valid JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate',
      payload: { prompt: 'Create a login automation for example.com' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('Login to Example')
    expect(body.meta.createdFrom).toBe('prompt')
    expect(body.steps).toHaveLength(3)
    expect(body.hosts).toContain('example.com')
  })

  it('parses correctly when LLM wraps output in markdown fencing', async () => {
    const markdownWrapped = '```json\n' + VALID_RECIPE_JSON + '\n```'
    app.ctx.modelRouter = fakeRouter(markdownWrapped)

    const res = await app.inject({
      method: 'POST',
      url: '/api/generate',
      payload: { prompt: 'Create a login automation' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('Login to Example')
    expect(body.meta.createdFrom).toBe('prompt')
  })

  it('returns 422 when LLM output is not valid JSON', async () => {
    app.ctx.modelRouter = fakeRouter('This is not JSON at all, sorry!')

    const res = await app.inject({
      method: 'POST',
      url: '/api/generate',
      payload: { prompt: 'Do something' },
    })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error).toBe('LLM returned invalid JSON')
  })

  it('returns 503 when no providers are configured', async () => {
    app.ctx.modelRouter = null

    const res = await app.inject({
      method: 'POST',
      url: '/api/generate',
      payload: { prompt: 'Create something' },
    })
    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.error).toContain('No model providers configured')
  })
})
