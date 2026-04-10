import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import type { LLMProviderConfig } from '@quokka/core'

export interface QuokkaConfig {
  provider?: LLMProviderConfig
  recipesDir?: string
  headed?: boolean
}

const CONFIG_FILENAMES = ['quokka.config.ts', 'quokka.config.js', 'quokka.config.mjs']

/**
 * Load quokka.config.{ts,js,mjs} from cwd.
 * Falls back to env vars for provider config.
 */
export async function loadConfig(): Promise<QuokkaConfig> {
  const cwd = process.cwd()

  // Try to load config file
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(cwd, filename)
    if (fs.existsSync(configPath)) {
      try {
        const mod = await import(pathToFileURL(configPath).href)
        const config = mod.default ?? mod
        return config as QuokkaConfig
      } catch {
        // Config file exists but failed to load — fall through to env
      }
    }
  }

  // Fall back to env vars
  return configFromEnv()
}

/**
 * Detect the best available provider from env vars.
 */
export function configFromEnv(): QuokkaConfig {
  const provider = detectProviderFromEnv()
  return provider ? { provider } : {}
}

/**
 * Detect provider config from environment variables.
 * Priority: ANTHROPIC > OPENAI > GOOGLE > FLOCK
 */
export function detectProviderFromEnv(): LLMProviderConfig | undefined {
  if (process.env.ANTHROPIC_API_KEY) {
    return { type: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY }
  }
  if (process.env.OPENAI_API_KEY) {
    return { type: 'openai', apiKey: process.env.OPENAI_API_KEY }
  }
  if (process.env.GOOGLE_AI_KEY) {
    return { type: 'google', apiKey: process.env.GOOGLE_AI_KEY }
  }
  if (process.env.FLOCK_API_KEY) {
    return { type: 'flock', apiKey: process.env.FLOCK_API_KEY }
  }
  return undefined
}

/**
 * Resolve provider config: CLI flags > config file > env vars.
 */
export function resolveProvider(
  config: QuokkaConfig,
  flags?: { provider?: string; model?: string },
): LLMProviderConfig | undefined {
  // CLI flags take highest priority
  if (flags?.provider) {
    const type = flags.provider as LLMProviderConfig['type']
    const envKey = getEnvKeyForProvider(type)
    const apiKey = envKey ? process.env[envKey] : undefined
    return { type, apiKey, model: flags.model }
  }

  // Config file provider with optional model override
  if (config.provider) {
    if (flags?.model) {
      return { ...config.provider, model: flags.model }
    }
    return config.provider
  }

  // Env var fallback
  const envProvider = detectProviderFromEnv()
  if (envProvider && flags?.model) {
    return { ...envProvider, model: flags.model }
  }
  return envProvider
}

function getEnvKeyForProvider(type: string): string | undefined {
  switch (type) {
    case 'anthropic': return 'ANTHROPIC_API_KEY'
    case 'openai': return 'OPENAI_API_KEY'
    case 'google': return 'GOOGLE_AI_KEY'
    case 'flock': return 'FLOCK_API_KEY'
    default: return undefined
  }
}
