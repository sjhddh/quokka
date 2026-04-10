import chalk from 'chalk'
import ora from 'ora'
import { createProvider } from '@quokka/core'
import type { RecipeV2 } from '@quokka/shared'
import { detectProviderFromEnv } from '../config.js'
import { loadRunner } from '../runner-bridge.js'

interface DemoFlags {
  headed?: boolean
}

const DEMO_RECIPE: RecipeV2 = {
  version: '2.0',
  id: 'demo-wikipedia-search',
  name: 'Demo: Wikipedia Search',
  description: 'Search Wikipedia for "quokka" — a zero-config demo',
  intent: 'Search Wikipedia for "quokka" and verify the article loads',
  steps: [
    {
      id: 'step_1',
      type: 'action',
      intent: 'Navigate to Wikipedia homepage',
      context_hint: 'Open https://en.wikipedia.org',
      likelyNavigates: true,
    },
    {
      id: 'boundary_1',
      type: 'page_boundary',
      expectedUrl: 'https://en.wikipedia.org',
      waitCondition: 'networkIdle',
    },
    {
      id: 'step_2',
      type: 'action',
      intent: 'Type "quokka" into the search input',
      context_hint: 'The main search box on Wikipedia',
      value: 'quokka',
      likelyNavigates: false,
    },
    {
      id: 'step_3',
      type: 'action',
      intent: 'Click the search button',
      context_hint: 'Submit the search form',
      verification: 'Search results or article page loads',
      likelyNavigates: true,
    },
    {
      id: 'boundary_2',
      type: 'page_boundary',
      waitCondition: 'networkIdle',
    },
  ],
  variables: { searchTerm: 'quokka' },
  hosts: ['en.wikipedia.org'],
  meta: { createdFrom: 'code', tags: ['demo'] },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export async function demoCommand(flags: DemoFlags): Promise<void> {
  console.log()
  console.log(chalk.bold('  Quokka Demo'))
  console.log(chalk.dim('  Searching Wikipedia for "quokka" using your API key'))
  console.log()

  // Detect provider from env
  const providerConfig = detectProviderFromEnv()

  if (!providerConfig) {
    console.error(chalk.red('  No API key found in environment.\n'))
    console.error(chalk.yellow('  Set one of these environment variables:'))
    console.error(chalk.dim('    export OPENAI_API_KEY=sk-...'))
    console.error(chalk.dim('    export ANTHROPIC_API_KEY=sk-ant-...'))
    console.error(chalk.dim('    export GOOGLE_AI_KEY=...'))
    console.error(chalk.dim('    export FLOCK_API_KEY=...'))
    console.error()
    process.exit(1)
  }

  const provider = createProvider(providerConfig)
  console.log(chalk.dim(`  Using provider: ${providerConfig.type}`))
  console.log()

  // Load runner
  const runner = await loadRunner()
  if (!runner) {
    process.exit(1)
  }

  const spinner = ora('Running demo recipe...').start()

  try {
    const result = await runner.run({
      recipe: DEMO_RECIPE,
      provider,
      headed: flags.headed,
      onStep: (stepId, status) => {
        spinner.text = `Demo step ${stepId}: ${status}`
      },
    })

    if (result.success) {
      spinner.succeed(chalk.green('Demo completed successfully!'))
      console.log()
      console.log(chalk.dim(`  ${result.stepsCompleted} steps executed`))
      console.log()
      console.log(chalk.bold('  Next steps:'))
      console.log(chalk.dim('    quokka init          — scaffold a new project'))
      console.log(chalk.dim('    quokka create "..."  — generate a recipe from description'))
      console.log()
    } else {
      spinner.fail(chalk.red('Demo failed'))
      if (result.errors.length > 0) {
        console.error(chalk.dim(result.errors.map(e => `  ${e}`).join('\n')))
      }
      process.exit(1)
    }
  } catch (err) {
    spinner.fail(chalk.red(`Demo error: ${err instanceof Error ? err.message : String(err)}`))
    process.exit(1)
  }
}
