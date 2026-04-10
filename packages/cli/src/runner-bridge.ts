import chalk from 'chalk'
import type { RecipeV2 } from '@quokka/shared'
import type { LLMProvider } from '@quokka/core'

export interface RunnerOptions {
  recipe: RecipeV2
  provider: LLMProvider
  headed?: boolean
  onStep?: (stepId: string, status: string) => void
}

export interface RunnerResult {
  success: boolean
  stepsCompleted: number
  stepsTotal: number
  errors: string[]
}

/**
 * Dynamically import @quokka/runner-playwright.
 * Returns null with a helpful message if the package is not installed.
 */
export async function loadRunner(): Promise<{
  run: (options: RunnerOptions) => Promise<RunnerResult>
} | null> {
  try {
    // @ts-expect-error — dynamic optional dependency, may not be installed
    const mod = await import('@quokka/runner-playwright')
    return mod
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('Cannot find module') ||
        err.message.includes('MODULE_NOT_FOUND') ||
        err.message.includes('ERR_MODULE_NOT_FOUND'))
    ) {
      console.error(
        chalk.red('\n  @quokka/runner-playwright is not installed.\n')
      )
      console.error(
        chalk.yellow('  Install it with:\n')
      )
      console.error(
        chalk.cyan('    pnpm add @quokka/runner-playwright\n')
      )
      console.error(
        chalk.dim('  The runner package provides Playwright-based browser automation.\n')
      )
      return null
    }
    throw err
  }
}
