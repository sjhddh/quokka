import type { FastifyPluginAsync } from 'fastify'
import type { Run, RunStatus, RunEvent } from '@quokka/shared'
import { nanoid } from 'nanoid'
import { eventBus } from '../events/event-bus.js'

export const runsPlugin: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: {
      recipeId: string
      slotValues: Record<string, string>
      mode?: 'headless' | 'extension'
    }
  }>('/api/runs', async (req, reply) => {
    const { recipeId, slotValues, mode } = req.body as {
      recipeId: string
      slotValues: Record<string, string>
      mode?: 'headless' | 'extension'
    }

    const run: Run = {
      id: nanoid(),
      recipeId,
      status: 'idle',
      slotValues: slotValues ?? {},
      currentStepIndex: 0,
    }

    const created = app.ctx.runRepo.create(run)

    if (mode === 'headless') {
      const recipe = app.ctx.recipeRepo.getById(recipeId)
      if (!recipe) {
        return reply.code(404).send({ error: 'Recipe not found' })
      }

      // Update status to running
      app.ctx.runRepo.updateStatus(created.id, 'running')

      // Execute in background — don't await
      import('@quokka/headless').then(({ runHeadless }) => {
        runHeadless(recipe, slotValues ?? {}, {
          onEvent: (event) => {
            // Persist event and broadcast via SSE
            app.ctx.eventRepo.create({
              ...event,
              runId: created.id,
            })
            eventBus.emitRunEvent(created.id, { ...event, runId: created.id })
          },
        })
          .then((result) => {
            const finalStatus = result.status === 'completed' ? 'completed' : 'failed'
            app.ctx.runRepo.updateStatus(
              created.id,
              finalStatus as RunStatus,
              { error: result.error, finishedAt: new Date().toISOString() },
            )
            // Emit final status event
            const finalEvent: RunEvent = {
              id: nanoid(),
              runId: created.id,
              type: result.status === 'completed' ? 'run_completed' : 'run_failed',
              timestamp: new Date().toISOString(),
            }
            eventBus.emitRunEvent(created.id, finalEvent)
          })
          .catch((err) => {
            const error = err instanceof Error ? err.message : String(err)
            app.ctx.runRepo.updateStatus(created.id, 'failed', { error, finishedAt: new Date().toISOString() })
            // Emit run_failed event so SSE clients are notified
            const failEvent: RunEvent = {
              id: nanoid(),
              runId: created.id,
              type: 'run_failed',
              timestamp: new Date().toISOString(),
            }
            eventBus.emitRunEvent(created.id, failEvent)
          })
      })

      return reply.code(201).send({ ...created, status: 'running' })
    }

    return reply.code(201).send(created)
  })

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

      // Emit a synthetic status-change event on the event bus
      const syntheticEvent: RunEvent = {
        id: nanoid(),
        runId: req.params.id,
        type: status === 'completed'
          ? 'run_completed'
          : status === 'failed'
            ? 'run_failed'
            : status === 'running'
              ? 'run_started'
              : 'run_started',
        timestamp: new Date().toISOString(),
      }
      eventBus.emitRunEvent(req.params.id, syntheticEvent)

      return updated
    },
  )
}
