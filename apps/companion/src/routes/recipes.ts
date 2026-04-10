import type { FastifyPluginAsync } from 'fastify'
import type { Recipe } from '@quokka/shared'
import { RecipeSchema, QuokkaExportSchema } from '@quokka/shared'
import { nanoid } from 'nanoid'

/** Unwrap a payload that may be a QuokkaExport wrapper or a raw Recipe */
function unwrapRecipePayload(body: unknown): unknown {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>
    if ('quokka_version' in obj && 'recipe' in obj) {
      return obj.recipe
    }
  }
  return body
}

export const recipesPlugin: FastifyPluginAsync = async (app) => {
  app.get('/api/recipes', async () => {
    return app.ctx.recipeRepo.list()
  })

  // Bulk export — must be registered before :id routes
  app.get('/api/recipes/export/all', async (_req, reply) => {
    const recipes = app.ctx.recipeRepo.list()
    const wrapped = recipes.map((recipe) => ({
      quokka_version: '0.3.0',
      exported_at: new Date().toISOString(),
      recipe,
    }))
    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename="recipes-all.quokka.json"')
      .send(wrapped)
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
    const wrapped = {
      quokka_version: '0.3.0',
      exported_at: new Date().toISOString(),
      recipe,
    }
    const safeName = recipe.name.replace(/[^a-zA-Z0-9_-]/g, '_')
    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${safeName}.quokka.json"`)
      .send(wrapped)
  })

  app.post('/api/recipes/import', async (req, reply) => {
    // Handle array payloads (from Export All) — each may be wrapped or raw
    if (Array.isArray(req.body)) {
      const results: Recipe[] = []
      const errors: { index: number; details: unknown }[] = []
      for (let i = 0; i < req.body.length; i++) {
        const unwrapped = unwrapRecipePayload(req.body[i])
        const result = RecipeSchema.safeParse(unwrapped)
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

    // Single recipe — may be wrapped in QuokkaExport envelope or raw
    const unwrapped = unwrapRecipePayload(req.body)
    const result = RecipeSchema.safeParse(unwrapped)
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
