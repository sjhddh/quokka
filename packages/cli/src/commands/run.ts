import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import { RecipeV2Schema } from '@quokka/shared'
import { createProvider } from '@quokka/core'
import { loadConfig, resolveProvider } from '../config.js'
import { loadRunner } from '../runner-bridge.js'

interface RunFlags {
  provider?: string
  model?: string
  headed?: boolean
}

export async function runCommand(recipePath: string, flags: RunFlags): Promise<void> {
  // Load recipe
  const spinner = ora('Loading recipe...').start()

  const resolvedPath = path.resolve(process.cwd(), recipePath)
  if (!fs.existsSync(resolvedPath)) {
    spinner.fail(chalk.red(`Recipe file not found: ${resolvedPath}`))
    process.exit(1)
  }

  let rawRecipe: unknown
  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8')
    rawRecipe = JSON.parse(content)
  } catch (err) {
    spinner.fail(chalk.red(`Failed to parse recipe: ${err instanceof Error ? err.message : String(err)}`))
    process.exit(1)
  }

  const parsed = RecipeV2Schema.safeParse(rawRecipe)
  if (!parsed.success) {
    spinner.fail(chalk.red('Invalid recipe format'))
    console.error(chalk.dim(parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')))
    process.exit(1)
  }

  const recipe = parsed.data
  spinner.succeed(`Loaded recipe: ${chalk.bold(recipe.name)}`)

  // Resolve provider
  const config = await loadConfig()
  const providerConfig = resolveProvider(config, flags)

  if (!providerConfig) {
    console.error(chalk.red('\n  No LLM provider configured.\n'))
    console.error(chalk.yellow('  Set an API key in your environment:'))
    console.error(chalk.dim('    export OPENAI_API_KEY=sk-...'))
    console.error(chalk.dim('    export ANTHROPIC_API_KEY=sk-ant-...'))
    console.error(chalk.dim('    export GOOGLE_AI_KEY=...'))
    console.error(chalk.dim('    export FLOCK_API_KEY=...'))
    console.error()
    console.error(chalk.yellow('  Or specify a provider:'))
    console.error(chalk.dim('    quokka run recipe.qk.json --provider openai'))
    console.error()
    process.exit(1)
  }

  const provider = createProvider(providerConfig)
  console.log(chalk.dim(`  Provider: ${providerConfig.type}${providerConfig.model ? ` (${providerConfig.model})` : ''}`))

  // Load runner
  const runner = await loadRunner()
  if (!runner) {
    process.exit(1)
  }

  // Execute
  const runSpinner = ora(`Running recipe: ${recipe.name}`).start()

  try {
    const result = await runner.run({
      recipe,
      provider,
      headed: flags.headed ?? config.headed,
      onStep: (stepId, status) => {
        runSpinner.text = `Step ${stepId}: ${status}`
      },
    })

    if (result.success) {
      runSpinner.succeed(
        chalk.green(`Recipe completed: ${result.stepsCompleted}/${result.stepsTotal} steps`)
      )
    } else {
      runSpinner.fail(
        chalk.red(`Recipe failed at step ${result.stepsCompleted}/${result.stepsTotal}`)
      )
      if (result.errors.length > 0) {
        console.error(chalk.dim(result.errors.map(e => `  ${e}`).join('\n')))
      }
      process.exit(1)
    }
  } catch (err) {
    runSpinner.fail(chalk.red(`Execution error: ${err instanceof Error ? err.message : String(err)}`))
    process.exit(1)
  }
}
