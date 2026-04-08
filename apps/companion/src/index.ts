import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createDb, RecipeRepo, RunRepo, EventRepo } from '@quokka/storage'
import { loadConfig } from './config.js'
import { recipesPlugin } from './routes/recipes.js'
import { runsPlugin } from './routes/runs.js'
import { compilePlugin } from './routes/compile.js'
import { providersPlugin } from './routes/providers.js'

export interface AppContext {
  recipeRepo: RecipeRepo
  runRepo: RunRepo
  eventRepo: EventRepo
}

declare module 'fastify' {
  interface FastifyInstance {
    ctx: AppContext
  }
}

export async function buildApp(dbPath?: string) {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  const db = createDb(dbPath)
  const ctx: AppContext = {
    recipeRepo: new RecipeRepo(db),
    runRepo: new RunRepo(db),
    eventRepo: new EventRepo(db),
  }

  app.decorate('ctx', ctx)

  await app.register(recipesPlugin)
  await app.register(runsPlugin)
  await app.register(compilePlugin)
  await app.register(providersPlugin)

  return app
}

async function main() {
  const config = loadConfig()
  const app = await buildApp(config.dbPath)

  try {
    await app.listen({ port: config.port, host: '127.0.0.1' })
    console.log(`Quokka Companion listening on http://127.0.0.1:${config.port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Only run main when executed directly (not imported for tests)
const isDirectRun = process.argv[1]?.includes('companion')
if (isDirectRun) {
  main()
}
