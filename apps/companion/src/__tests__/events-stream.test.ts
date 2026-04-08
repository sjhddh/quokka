import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import http from 'node:http'
import { createDb, RecipeRepo, RunRepo, EventRepo, ProviderRepo } from '@quokka/storage'
import type { RunEvent } from '@quokka/shared'
import { nanoid } from 'nanoid'
import { eventsStreamPlugin } from '../routes/events-stream.js'
import { runsPlugin } from '../routes/runs.js'
import { eventBus } from '../events/event-bus.js'
import type { AppContext } from '../index.js'

let app: FastifyInstance
let eventRepo: EventRepo
let port: number

beforeAll(async () => {
  app = Fastify()
  await app.register(cors, { origin: true })

  const db = createDb() // in-memory
  eventRepo = new EventRepo(db)
  const ctx: AppContext = {
    recipeRepo: new RecipeRepo(db),
    runRepo: new RunRepo(db),
    eventRepo,
    providerRepo: new ProviderRepo(db),
    modelRouter: null,
  }
  app.decorate('ctx', ctx)

  await app.register(runsPlugin)
  await app.register(eventsStreamPlugin)
  await app.ready()

  // Start on a random port for real HTTP tests
  const address = await app.listen({ port: 0, host: '127.0.0.1' })
  port = Number(new URL(address).port)
})

afterAll(async () => {
  await app.close()
})

function getSSE(path: string): Promise<{ headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve) => {
    let resolved = false
    const done = (headers: http.IncomingHttpHeaders, body: string) => {
      if (resolved) return
      resolved = true
      resolve({ headers, body })
    }

    const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk.toString()
        // Once we have data, give a small window for more, then finish
        setTimeout(() => {
          req.destroy()
          done(res.headers, body)
        }, 100)
      })
      // If no data arrives quickly, resolve with empty body after headers
      setTimeout(() => {
        req.destroy()
        done(res.headers, body)
      }, 500)
    })
    req.on('error', () => {
      // ECONNRESET is expected when we destroy — ignore
    })
  })
}

describe('SSE event streaming', () => {
  it('returns correct content-type headers', async () => {
    const { headers } = await getSSE('/api/runs/test-run/events/stream')
    expect(headers['content-type']).toBe('text/event-stream')
    expect(headers['cache-control']).toBe('no-cache')
    expect(headers['connection']).toBe('keep-alive')
  })

  it('sends existing events on connection', async () => {
    const runId = 'run-with-events'
    const event: RunEvent = {
      id: nanoid(),
      runId,
      type: 'run_started',
      timestamp: new Date().toISOString(),
    }
    eventRepo.create(event)

    const { body } = await getSSE(`/api/runs/${runId}/events/stream`)

    const lines = body.split('\n').filter((l) => l.startsWith('data: '))
    expect(lines.length).toBeGreaterThanOrEqual(1)

    const parsed = JSON.parse(lines[0].replace('data: ', ''))
    expect(parsed.runId).toBe(runId)
    expect(parsed.type).toBe('run_started')
  })

  it('EventBus delivers new events to subscribers', () => {
    const runId = 'bus-test-run'
    const received: RunEvent[] = []

    const handler = (event: RunEvent) => {
      received.push(event)
    }
    eventBus.onRunEvent(runId, handler)

    const event: RunEvent = {
      id: nanoid(),
      runId,
      type: 'step_started',
      stepIndex: 0,
      timestamp: new Date().toISOString(),
    }
    eventBus.emitRunEvent(runId, event)

    expect(received).toHaveLength(1)
    expect(received[0].type).toBe('step_started')
    expect(received[0].runId).toBe(runId)

    eventBus.offRunEvent(runId, handler)

    // After unsubscribe, should not receive
    eventBus.emitRunEvent(runId, event)
    expect(received).toHaveLength(1)
  })
})
