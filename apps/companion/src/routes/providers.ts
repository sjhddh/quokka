import type { FastifyPluginAsync } from 'fastify'
import { ModelRouter } from '@quokka/core'

interface ProviderBody {
  id: string
  name: string
  type: string
  apiKey?: string
  baseUrl?: string
  model?: string
}

export const providersPlugin: FastifyPluginAsync = async (app) => {
  app.get('/api/providers', async () => {
    const rows = app.ctx.providerRepo.list()
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      apiKey: r.apiKey ?? undefined,
      baseUrl: r.baseUrl ?? undefined,
      model: r.model ?? undefined,
    }))
  })

  app.post<{ Body: ProviderBody }>('/api/providers', async (req, reply) => {
    const body = req.body as ProviderBody
    if (!body.id || !body.name || !body.type) {
      return reply.code(400).send({ error: 'id, name, and type are required' })
    }
    const row = app.ctx.providerRepo.create({
      id: body.id,
      name: body.name,
      type: body.type,
      apiKey: body.apiKey ?? null,
      baseUrl: body.baseUrl ?? null,
      model: body.model ?? null,
    })
    // Sync modelRouter: register new provider
    if (!app.ctx.modelRouter) {
      app.ctx.modelRouter = new ModelRouter()
    }
    app.ctx.modelRouter.register({
      id: row.id,
      name: row.name,
      type: row.type as 'openai-compatible' | 'mock',
      apiKey: row.apiKey ?? undefined,
      baseUrl: row.baseUrl ?? undefined,
      model: row.model ?? undefined,
    })

    return reply.code(201).send({
      id: row.id,
      name: row.name,
      type: row.type,
      apiKey: row.apiKey ?? undefined,
      baseUrl: row.baseUrl ?? undefined,
      model: row.model ?? undefined,
    })
  })

  app.delete<{ Params: { id: string } }>('/api/providers/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const deleted = app.ctx.providerRepo.delete(id)
    if (!deleted) {
      return reply.code(404).send({ error: 'Provider not found' })
    }
    // Sync modelRouter: remove provider
    if (app.ctx.modelRouter) {
      app.ctx.modelRouter.unregister(id)
    }
    return { ok: true }
  })

  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })
}
