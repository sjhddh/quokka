import type { FastifyPluginAsync } from 'fastify'
import type { Recipe } from '@quokka/shared'
import { RecipeSchema } from '@quokka/shared'
import { nanoid } from 'nanoid'

export const recipesPlugin: FastifyPluginAsync = async (app) => {
  app.get('/api/recipes', async () => {
    return app.ctx.recipeRepo.list()
  })

  // Bulk export — must be registered before :id routes
  app.get('/api/recipes/export/all', async (_req, reply) => {
    const recipes = app.ctx.recipeRepo.list()
    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename="recipes-all.json"')
      .send(recipes)
  })

  app.get<{ Params: { id: string } }>('/api/recipes/:id', async (req, reply) => {
    const recipe = app.ctx.recipeRepo.getById(req.params.id)
    if (!recipe) {
      return reply.code(404).send({ error: 'Recipe not found' })
    }
    return recipe
  })

  app.get<{ Params: { id: string } }>('/api/recipes/:id/export', async (req, reply) => {
    const recipe = app.ctx.recipeRepo.getById(req.params.id)
    if (!recipe) {
      return reply.code(404).send({ error: 'Recipe not found' })
    }
    const safeName = recipe.name.replace(/[^a-zA-Z0-9_-]/g, '_')
    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="recipe-${safeName}.json"`)
      .send(recipe)
  })

  app.post('/api/recipes/import', async (req, reply) => {
    // Handle array payloads (from Export All)
    if (Array.isArray(req.body)) {
      const results: Recipe[] = []
      const errors: { index: number; details: unknown }[] = []
      for (let i = 0; i < req.body.length; i++) {
        const result = RecipeSchema.safeParse(req.body[i])
        if (!result.success) {
          errors.push({ index: i, details: result.error.format() })
          continue
        }
        const imported: Recipe = {
          ...result.data,
          id: nanoid(),
          meta: { ...result.data.meta, createdFrom: 'import' },
        }
        results.push(app.ctx.recipeRepo.create(imported))
      }
      if (errors.length > 0 && results.length === 0) {
        return reply.code(400).send({ error: 'All recipes failed validation', errors })
      }
      return reply.code(201).send({ imported: results, errors })
    }

    const result = RecipeSchema.safeParse(req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation failed', details: result.error.format() })
    }
    const imported: Recipe = {
      ...result.data,
      id: nanoid(),
      meta: { ...result.data.meta, createdFrom: 'import' },
    }
    const created = app.ctx.recipeRepo.create(imported)
    return reply.code(201).send(created)
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
