import type { FastifyPluginAsync } from 'fastify'
import { eventBus } from '../events/event-bus.js'
import type { RunEvent } from '@quokka/shared'

export const eventsStreamPlugin: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>(
    '/api/runs/:id/events/stream',
    async (req, reply) => {
      const runId = req.params.id

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      // Flush headers immediately with a comment
      reply.raw.write(`: connected\n\n`)

      // Send existing events first
      const existingEvents = app.ctx.eventRepo.listByRun(runId)
      for (const event of existingEvents) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      }

      // Subscribe to new events
      const handler = (event: RunEvent) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      }
      eventBus.onRunEvent(runId, handler)

      // Keepalive every 15 seconds
      const keepalive = setInterval(() => {
        reply.raw.write(`: keepalive\n\n`)
      }, 15_000)

      // Clean up on disconnect
      req.raw.on('close', () => {
        clearInterval(keepalive)
        eventBus.offRunEvent(runId, handler)
        reply.raw.end()
      })

      // Don't await — long-lived connection
      return reply
    },
  )
}
