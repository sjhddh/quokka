import type { FastifyPluginAsync } from 'fastify'
import { compileTrace } from '@quokka/core'
import type { WatchTrace } from '@quokka/core'

export const compilePlugin: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { trace: WatchTrace; name?: string } }>(
    '/api/compile',
    async (req) => {
      const { trace, name } = req.body as { trace: WatchTrace; name?: string }
      const recipe = compileTrace(trace, { name })
      return recipe
    },
  )
}
