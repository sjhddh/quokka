import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { detectProviderFromEnv } from '../config.js'

const SAMPLE_RECIPE = {
  version: '2.0',
  id: 'sample-search',
  name: 'Sample Wikipedia Search',
  description: 'Search Wikipedia for a term and verify the results page',
  intent: 'Search Wikipedia for "quokka" and verify the article loads',
  steps: [
    {
      id: 'step_1',
      type: 'action',
      intent: 'Navigate to Wikipedia homepage',
      context_hint: 'Open the main Wikipedia page',
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
      intent: 'Type "quokka" into the search box',
      context_hint: 'The main search input on Wikipedia',
      value: 'quokka',
      likelyNavigates: false,
    },
    {
      id: 'step_3',
      type: 'action',
      intent: 'Click the search button to submit',
      context_hint: 'The search/submit button next to the search input',
      verification: 'Page navigates to search results or article',
      likelyNavigates: true,
    },
    {
      id: 'boundary_2',
      type: 'page_boundary',
      waitCondition: 'networkIdle',
    },
  ],
  variables: {
    searchTerm: 'quokka',
  },
  hosts: ['en.wikipedia.org'],
  meta: {
    createdFrom: 'code' as const,
    tags: ['sample', 'search'],
  },
}

function buildConfigContent(): string {
  const provider = detectProviderFromEnv()

  let providerBlock: string
  if (provider) {
    providerBlock = `  provider: {
    type: '${provider.type}',
    // API key loaded from environment variable
  },`
  } else {
    providerBlock = `  // provider: {
  //   type: 'openai',  // or 'anthropic', 'google', 'flock'
  //   apiKey: process.env.OPENAI_API_KEY,
  // },`
  }

  return `/** @type {import('@quokka/cli').QuokkaConfig} */
export default {
${providerBlock}
  recipesDir: '.qk',
}
`
}

export async function initCommand(): Promise<void> {
  const cwd = process.cwd()
  const qkDir = path.join(cwd, '.qk')
  const configPath = path.join(cwd, 'quokka.config.ts')

  console.log()
  console.log(chalk.bold('  Initializing Quokka project...'))
  console.log()

  // Create .qk directory
  if (!fs.existsSync(qkDir)) {
    fs.mkdirSync(qkDir, { recursive: true })
    console.log(chalk.green('  +') + ' Created .qk/ directory')
  } else {
    console.log(chalk.dim('  . .qk/ directory already exists'))
  }

  // Create config file
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, buildConfigContent(), 'utf-8')
    console.log(chalk.green('  +') + ' Created quokka.config.ts')
  } else {
    console.log(chalk.dim('  . quokka.config.ts already exists'))
  }

  // Create sample recipe
  const samplePath = path.join(qkDir, 'sample-search.qk.json')
  if (!fs.existsSync(samplePath)) {
    fs.writeFileSync(samplePath, JSON.stringify(SAMPLE_RECIPE, null, 2) + '\n', 'utf-8')
    console.log(chalk.green('  +') + ' Created .qk/sample-search.qk.json')
  } else {
    console.log(chalk.dim('  . .qk/sample-search.qk.json already exists'))
  }

  console.log()
  console.log(chalk.bold('  Next steps:'))
  console.log()
  console.log(chalk.cyan('    1.') + ' Set an API key in your environment:')
  console.log(chalk.dim('       export OPENAI_API_KEY=sk-...'))
  console.log(chalk.dim('       export ANTHROPIC_API_KEY=sk-ant-...'))
  console.log()
  console.log(chalk.cyan('    2.') + ' Install the Playwright runner:')
  console.log(chalk.dim('       pnpm add @quokka/runner-playwright'))
  console.log()
  console.log(chalk.cyan('    3.') + ' Run the sample recipe:')
  console.log(chalk.dim('       quokka run .qk/sample-search.qk.json'))
  console.log()
  console.log(chalk.cyan('    4.') + ' Or try the demo:')
  console.log(chalk.dim('       quokka demo'))
  console.log()
}
