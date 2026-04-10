import type { RecipeV2 } from '@quokka/shared'
import type { ModelProvider } from '@quokka/core'

// ─── Runner configuration ────────────────────────────────────────────────────

export interface RunnerOptions {
  /** Launch browser in headless mode (default: true) */
  headless?: boolean
  /** Milliseconds to wait between actions (default: 0) */
  slowMo?: number
  /** Per-action timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Browser viewport size */
  viewport?: { width: number; height: number }
  /** Capture screenshot on action failure (default: false) */
  screenshotOnFailure?: boolean
  /** Directory to write failure screenshots (default: ./screenshots) */
  screenshotDir?: string
}

// ─── Run result ──────────────────────────────────────────────────────────────

export interface RunResult {
  status: 'completed' | 'failed'
  stepsExecuted: number
  totalSteps: number
  /** Total run duration in milliseconds */
  duration: number
  /** Error message if status is 'failed' */
  error?: string
  /** Paths to screenshots captured during the run */
  screenshots?: string[]
}

// ─── Runner interface ────────────────────────────────────────────────────────

export interface IRunner {
  run(
    recipe: RecipeV2,
    variables: Record<string, string>,
    provider: ModelProvider,
  ): Promise<RunResult>
  close(): Promise<void>
}
