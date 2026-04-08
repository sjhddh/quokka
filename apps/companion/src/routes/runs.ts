import type { FastifyPluginAsync } from 'fastify'
import type { Run, RunStatus } from '@quokka/shared'
import { nanoid } from 'nanoid'

export const runsPlugin: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { recipeId: string; slotValues: Record<string, string> } }>(
    '/api/runs',
    async (req, reply) => {
      const { recipeId, slotValues } = req.body as {
        recipeId: string
        slotValues: Record<string, string>
      }

      const run: Run = {
        id: nanoid(),
        recipeId,
        status: 'idle',
        slotValues: slotValues ?? {},
        currentStepIndex: 0,
      }

      const created = app.ctx.runRepo.create(run)
      return reply.code(201).send(created)
    },
  )

  app.get<{ Params: { id: string } }>('/api/runs/:id', async (req, reply) => {
    const run = app.ctx.runRepo.getById(req.params.id)
    if (!run) {
      return reply.code(404).send({ error: 'Run not found' })
    }
    return run
  })

  app.get<{ Params: { id: string } }>('/api/runs/:id/events', async (req) => {
    return app.ctx.eventRepo.listByRun(req.params.id)
  })

  app.patch<{ Params: { id: string }; Body: { status: RunStatus } }>(
    '/api/runs/:id',
    async (req, reply) => {
      const { status } = req.body as { status: RunStatus }
      const updated = app.ctx.runRepo.updateStatus(req.params.id, status)
      if (!updated) {
        return reply.code(404).send({ error: 'Run not found' })
      }
      return updated
    },
  )
}
