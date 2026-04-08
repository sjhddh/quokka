import type { FastifyPluginAsync } from 'fastify'

interface ProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  models: string[]
}

// In-memory provider store for v0
const providers: Map<string, ProviderConfig> = new Map()

export const providersPlugin: FastifyPluginAsync = async (app) => {
  app.get('/api/providers', async () => {
    return [...providers.values()]
  })

  app.post<{ Body: ProviderConfig }>('/api/providers', async (req, reply) => {
    const config = req.body as ProviderConfig
    providers.set(config.id, config)
    return reply.code(201).send(config)
  })

  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })
}
