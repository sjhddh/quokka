import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { RecipeV2Schema } from '@quokka/shared'
import type { RecipeV2 } from '@quokka/shared'

export async function planCommand(recipePath: string): Promise<void> {
  const resolvedPath = path.resolve(process.cwd(), recipePath)
  if (!fs.existsSync(resolvedPath)) {
    console.error(chalk.red(`\n  Recipe file not found: ${resolvedPath}\n`))
    process.exit(1)
  }

  let rawRecipe: unknown
  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8')
    rawRecipe = JSON.parse(content)
  } catch (err) {
    console.error(chalk.red(`\n  Failed to parse recipe: ${err instanceof Error ? err.message : String(err)}\n`))
    process.exit(1)
  }

  const parsed = RecipeV2Schema.safeParse(rawRecipe)
  if (!parsed.success) {
    console.error(chalk.red('\n  Invalid recipe format'))
    console.error(chalk.dim(parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')))
    process.exit(1)
  }

  const recipe: RecipeV2 = parsed.data
  displayPlan(recipe)
}

function displayPlan(recipe: RecipeV2): void {
  console.log()
  console.log(chalk.bold(`  Execution plan for: ${recipe.name}`))
  console.log(chalk.dim(`  ${recipe.description ?? recipe.intent}`))
  console.log()

  if (recipe.variables && Object.keys(recipe.variables).length > 0) {
    console.log(chalk.bold('  Variables:'))
    for (const [key, value] of Object.entries(recipe.variables)) {
      console.log(chalk.dim(`    ${key}: `) + value)
    }
    console.log()
  }

  if (recipe.hosts && recipe.hosts.length > 0) {
    console.log(chalk.bold('  Target hosts:'))
    for (const host of recipe.hosts) {
      console.log(chalk.dim(`    ${host}`))
    }
    console.log()
  }

  // Group steps by page phases (split at page_boundary steps)
  let phaseIndex = 1
  let currentPhaseSteps: Array<{ id: string; intent?: string; value?: string; verification?: string; likelyNavigates?: boolean }> = []

  console.log(chalk.bold('  Execution phases:'))
  console.log(chalk.dim('  ═══════════════════════════════════'))

  for (const step of recipe.steps) {
    if (step.type === 'page_boundary') {
      // Flush current phase
      if (currentPhaseSteps.length > 0) {
        printPhase(phaseIndex, currentPhaseSteps)
        phaseIndex++
      }

      console.log()
      console.log(
        chalk.yellow(`  ── Page boundary ──`) +
        (step.expectedUrl ? chalk.dim(` → ${step.expectedUrl}`) : '') +
        (step.waitCondition ? chalk.dim(` [wait: ${step.waitCondition}]`) : '')
      )
      console.log()

      currentPhaseSteps = []
    } else if (step.type === 'action') {
      currentPhaseSteps.push(step)
    }
  }

  // Flush final phase
  if (currentPhaseSteps.length > 0) {
    printPhase(phaseIndex, currentPhaseSteps)
  }

  console.log()
  console.log(chalk.dim('  ═══════════════════════════════════'))

  const actionCount = recipe.steps.filter(s => s.type === 'action').length
  const boundaryCount = recipe.steps.filter(s => s.type === 'page_boundary').length

  console.log()
  console.log(chalk.bold('  Summary:'))
  console.log(chalk.dim(`    ${actionCount} action steps across ${boundaryCount + 1} page phases`))
  console.log(chalk.dim(`    ${boundaryCount} page navigation(s)`))
  console.log()
  console.log(chalk.dim('  This is a dry run — no browser actions were executed.'))
  console.log(chalk.dim('  Run with: quokka run ' + process.argv[process.argv.length - 1]))
  console.log()
}

function printPhase(
  index: number,
  steps: Array<{ id: string; intent?: string; value?: string; verification?: string; likelyNavigates?: boolean }>,
): void {
  console.log(chalk.cyan(`  Phase ${index}`) + chalk.dim(` (${steps.length} steps)`))
  for (const step of steps) {
    const nav = step.likelyNavigates ? chalk.yellow(' [navigates]') : ''
    const val = step.value ? chalk.dim(` → "${step.value}"`) : ''
    const verify = step.verification ? chalk.dim(` ✓ ${step.verification}`) : ''

    console.log(`    ${chalk.dim(step.id + ':')} ${step.intent ?? ''}${val}${nav}${verify}`)
  }
}
