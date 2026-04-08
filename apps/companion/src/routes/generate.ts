import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import { RecipeSchema } from '@quokka/shared'
import { buildRecipePrompt } from '../prompts/recipe-generator.js'

interface GenerateBody {
  prompt: string
  providerId?: string
}

function tryExtractJson(raw: string): string {
  // Try to extract JSON from markdown fencing
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()

  // Try to find a JSON object in the response
  const objMatch = raw.match(/\{[\s\S]*\}/)
  if (objMatch) return objMatch[0]

  return raw
}

export const generatePlugin: FastifyPluginAsync = async (app) => {
  app.post<{ Body: GenerateBody }>('/api/generate', async (req, reply) => {
    const body = req.body as GenerateBody

    if (!body.prompt || typeof body.prompt !== 'string') {
      return reply.code(400).send({ error: 'prompt is required' })
    }

    // Get the model router from context
    const router = app.ctx.modelRouter
    if (!router) {
      return reply
        .code(503)
        .send({
          error: 'No model providers configured. Add a provider via POST /api/providers first.',
        })
    }

    let provider
    try {
      provider = router.route(body.providerId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Provider error'
      if (message.includes('No providers registered')) {
        return reply
          .code(503)
          .send({
            error:
              'No model providers configured. Add a provider via POST /api/providers first.',
          })
      }
      return reply.code(400).send({ error: message })
    }

    const { system, user } = buildRecipePrompt(body.prompt)

    let rawResponse: string
    try {
      rawResponse = await provider.complete(user, { system })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'LLM call failed'
      return reply.code(502).send({ error: `LLM request failed: ${message}` })
    }

    // Try to parse the response as JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(rawResponse)
    } catch {
      // LLM may have wrapped in markdown — try to extract
      const extracted = tryExtractJson(rawResponse)
      try {
        parsed = JSON.parse(extracted)
      } catch {
        return reply.code(422).send({
          error: 'LLM returned invalid JSON',
          raw: rawResponse,
        })
      }
    }

    // Inject id and ensure meta.createdFrom = 'prompt'
    const withId = {
      ...(parsed as Record<string, unknown>),
      id: nanoid(),
      meta: {
        ...((parsed as Record<string, unknown>).meta as Record<string, unknown> || {}),
        createdFrom: 'prompt' as const,
      },
    }

    const result = RecipeSchema.safeParse(withId)
    if (!result.success) {
      return reply.code(422).send({
        error: 'LLM output does not match Recipe schema',
        details: result.error.issues,
      })
    }

    // Optionally save to DB
    app.ctx.recipeRepo.create(result.data)

    return result.data
  })
}
