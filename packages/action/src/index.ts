import * as core from '@actions/core'
import { DefaultArtifactClient } from '@actions/artifact'
import { glob } from 'glob'
import { readFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createProvider } from '@quokka/core'
import type { LLMProviderConfig } from '@quokka/core'
import { RecipeV2Schema } from '@quokka/shared'
import { PlaywrightRunner } from '@quokka/runner-playwright'

interface RecipeResult {
  file: string
  status: 'completed' | 'failed'
  stepsExecuted: number
  duration: number
  error?: string
  screenshotPath?: string
}

async function run(): Promise<void> {
  const recipePattern = core.getInput('recipe', { required: true })
  const provider = core.getInput('provider') || 'openai'
  const apiKey = core.getInput('api-key', { required: true })
  const headless = core.getInput('headless') !== 'false'
  const timeout = parseInt(core.getInput('timeout') || '30000', 10)
  const screenshotOnFailure = core.getInput('screenshot-on-failure') !== 'false'

  // Set the appropriate env var so the provider can pick up the key
  const envKeyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_AI_KEY',
    flock: 'FLOCK_API_KEY',
  }
  const envKey = envKeyMap[provider]
  if (envKey) {
    process.env[envKey] = apiKey
  }

  // Install playwright browsers if not present
  try {
    core.info('Ensuring Playwright browsers are installed...')
    execSync('npx playwright install --with-deps chromium', { stdio: 'inherit' })
  } catch {
    core.warning('Playwright browser install failed — assuming already available')
  }

  // Glob-expand recipe paths
  const files = await glob(recipePattern)
  if (files.length === 0) {
    core.setFailed(`No recipe files matched pattern: ${recipePattern}`)
    return
  }

  core.info(`Found ${files.length} recipe file(s)`)

  // Create LLM provider
  const providerConfig: LLMProviderConfig = {
    type: provider as LLMProviderConfig['type'],
    apiKey,
  }
  const llmProvider = createProvider(providerConfig)

  const screenshotDir = resolve('.quokka-screenshots')
  const runner = new PlaywrightRunner({
    headless,
    timeout,
    screenshotOnFailure,
    screenshotDir,
  })

  const results: RecipeResult[] = []
  let totalSteps = 0
  const startTime = Date.now()

  for (const file of files) {
    const recipePath = resolve(file)
    core.startGroup(`Running: ${file}`)

    try {
      const raw = await readFile(recipePath, 'utf-8')
      const parsed = JSON.parse(raw)
      const recipe = RecipeV2Schema.parse(parsed)

      const recipeStart = Date.now()
      const result = await runner.run(recipe, {}, llmProvider)
      const duration = Date.now() - recipeStart

      totalSteps += result.stepsExecuted
      const recipeResult: RecipeResult = {
        file,
        status: result.status,
        stepsExecuted: result.stepsExecuted,
        duration,
        error: result.error,
      }

      if (result.status === 'failed' && result.screenshots?.length) {
        recipeResult.screenshotPath = result.screenshots[0]
      }

      results.push(recipeResult)

      if (result.status === 'failed') {
        core.error(`Recipe failed: ${file} - ${result.error}`)
      } else {
        core.info(`Recipe completed: ${file} (${result.stepsExecuted} steps, ${duration}ms)`)
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      core.error(`Recipe error: ${file} - ${error}`)
      results.push({
        file,
        status: 'failed',
        stepsExecuted: 0,
        duration: 0,
        error,
      })
    }

    core.endGroup()
  }

  await runner.close()

  const totalDuration = Date.now() - startTime
  const anyFailed = results.some((r) => r.status === 'failed')

  // Upload failure screenshots as artifacts
  const screenshotPaths = results
    .filter((r) => r.screenshotPath)
    .map((r) => r.screenshotPath!)

  if (screenshotPaths.length > 0) {
    try {
      mkdirSync(screenshotDir, { recursive: true })
      const artifact = new DefaultArtifactClient()
      await artifact.uploadArtifact(
        'quokka-failure-screenshots',
        screenshotPaths,
        screenshotDir,
      )
      core.info(`Uploaded ${screenshotPaths.length} failure screenshot(s) as artifact`)
    } catch {
      core.warning('Failed to upload screenshot artifacts')
    }
  }

  // Set outputs
  core.setOutput('status', anyFailed ? 'failed' : 'completed')
  core.setOutput('steps-executed', String(totalSteps))
  core.setOutput('duration', String(totalDuration))

  // Summary
  core.info('---')
  core.info(`Results: ${results.filter((r) => r.status === 'completed').length}/${results.length} passed`)
  core.info(`Total steps: ${totalSteps}`)
  core.info(`Duration: ${totalDuration}ms`)

  if (anyFailed) {
    const failedRecipes = results.filter((r) => r.status === 'failed')
    core.setFailed(
      `${failedRecipes.length} recipe(s) failed: ${failedRecipes.map((r) => r.file).join(', ')}`,
    )
  }
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err))
})
