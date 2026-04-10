import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import { createProvider } from '@quokka/core'
import { loadConfig, resolveProvider } from '../config.js'

interface CreateFlags {
  provider?: string
  model?: string
  name?: string
}

const RECIPE_GENERATION_SYSTEM_PROMPT = `You are a browser automation recipe generator for Quokka.
Given a natural language description of a task, generate a v2 recipe JSON.

The recipe must follow this schema:
- version: "2.0"
- id: a slug-style unique id
- name: human-readable name
- description: what the recipe does
- intent: the overall intent
- steps: array of action steps and page_boundary steps

Action step:
{
  "id": "step_N",
  "type": "action",
  "intent": "what this step does in natural language",
  "context_hint": "hint about where/what element to interact with",
  "value": "optional value for type/select actions",
  "verification": "optional check after this step",
  "likelyNavigates": boolean
}

Page boundary step:
{
  "id": "boundary_N",
  "type": "page_boundary",
  "expectedUrl": "optional URL pattern",
  "waitCondition": "networkIdle" | "domContentLoaded" | "load"
}

Insert page_boundary steps between actions that navigate to a new page.
Output ONLY the JSON object, no markdown fences.`

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export async function createCommand(description: string, flags: CreateFlags): Promise<void> {
  const config = await loadConfig()
  const providerConfig = resolveProvider(config, flags)

  if (!providerConfig) {
    console.error(chalk.red('\n  No LLM provider configured.'))
    console.error(chalk.dim('  Set an API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) or use --provider.\n'))
    process.exit(1)
  }

  const provider = createProvider(providerConfig)
  const spinner = ora('Generating recipe from description...').start()

  try {
    const response = await provider.complete(
      [
        { role: 'system', content: RECIPE_GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: description },
      ],
      { temperature: 0.3 },
    )

    // Strip any markdown fences
    const cleaned = response
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    let recipe: Record<string, unknown>
    try {
      recipe = JSON.parse(cleaned)
    } catch {
      spinner.fail(chalk.red('Failed to parse LLM response as JSON'))
      console.error(chalk.dim(`  Raw response:\n  ${response.slice(0, 500)}`))
      process.exit(1)
    }

    // Ensure version
    recipe.version = '2.0'
    recipe.createdAt = new Date().toISOString()
    recipe.updatedAt = new Date().toISOString()
    if (!recipe.meta) {
      recipe.meta = { createdFrom: 'prompt' }
    }

    spinner.succeed('Recipe generated')

    // Determine output path
    const recipeName = flags.name ?? slugify(recipe.name as string ?? description)
    const qkDir = path.join(process.cwd(), '.qk')
    if (!fs.existsSync(qkDir)) {
      fs.mkdirSync(qkDir, { recursive: true })
    }

    const outputPath = path.join(qkDir, `${recipeName}.qk.json`)
    fs.writeFileSync(outputPath, JSON.stringify(recipe, null, 2) + '\n', 'utf-8')

    console.log()
    console.log(chalk.green('  Saved to: ') + chalk.bold(path.relative(process.cwd(), outputPath)))
    console.log()

    // Preview the recipe
    console.log(chalk.bold('  Recipe preview:'))
    console.log(chalk.dim('  ─────────────────────────────────'))
    console.log(chalk.cyan(`  Name: `) + (recipe.name as string))
    console.log(chalk.cyan(`  Intent: `) + (recipe.intent as string))

    const steps = recipe.steps as Array<{ id: string; type: string; intent?: string }>
    if (Array.isArray(steps)) {
      console.log(chalk.cyan(`  Steps:`))
      for (const step of steps) {
        if (step.type === 'action') {
          console.log(chalk.dim(`    ${step.id}: `) + (step.intent ?? ''))
        } else if (step.type === 'page_boundary') {
          console.log(chalk.dim(`    ${step.id}: `) + chalk.yellow('[page boundary]'))
        }
      }
    }

    console.log()
    console.log(chalk.dim('  Run it with:'))
    console.log(chalk.dim(`    quokka run ${path.relative(process.cwd(), outputPath)}`))
    console.log()
  } catch (err) {
    spinner.fail(chalk.red(`Failed to generate recipe: ${err instanceof Error ? err.message : String(err)}`))
    process.exit(1)
  }
}
