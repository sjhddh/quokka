import type { FastifyPluginAsync } from 'fastify'
import type { Recipe } from '@quokka/shared'
import { nanoid } from 'nanoid'

export const recipesPlugin: FastifyPluginAsync = async (app) => {
  app.get('/api/recipes', async () => {
    return app.ctx.recipeRepo.list()
  })

  app.get<{ Params: { id: string } }>('/api/recipes/:id', async (req, reply) => {
    const recipe = app.ctx.recipeRepo.getById(req.params.id)
    if (!recipe) {
      return reply.code(404).send({ error: 'Recipe not found' })
    }
    return recipe
  })

  app.post<{ Body: Recipe }>('/api/recipes', async (req, reply) => {
    const body = req.body as Recipe
    const recipe: Recipe = {
      ...body,
      id: body.id || nanoid(),
    }
    const created = app.ctx.recipeRepo.create(recipe)
    return reply.code(201).send(created)
  })

  app.put<{ Params: { id: string }; Body: Partial<Recipe> }>(
    '/api/recipes/:id',
    async (req, reply) => {
      const updated = app.ctx.recipeRepo.update(req.params.id, req.body as Partial<Recipe>)
      if (!updated) {
        return reply.code(404).send({ error: 'Recipe not found' })
      }
      return updated
    },
  )

  app.delete<{ Params: { id: string } }>('/api/recipes/:id', async (req, reply) => {
    const deleted = app.ctx.recipeRepo.delete(req.params.id)
    if (!deleted) {
      return reply.code(404).send({ error: 'Recipe not found' })
    }
    return { ok: true }
  })
}
