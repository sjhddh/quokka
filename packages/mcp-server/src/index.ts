#!/usr/bin/env node

/**
 * Quokka MCP Server — lets AI agents invoke browser automation via the MCP protocol.
 *
 * Tools:
 *   quokka_execute  — Execute a browser task from an intent string
 *   quokka_observe  — Observe a page and answer a question about it
 *   quokka_plan     — Plan a multi-step browser task without executing
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { createProvider, type LLMProvider, type ModelProvider } from '@quokka/core'
import type { ProviderConfig } from '@quokka/core'

import { SessionManager } from './session.js'
import { handleExecute } from './tools/execute.js'
import { handleObserve } from './tools/observe.js'
import { handlePlan } from './tools/plan.js'
import { isAuthEnabled } from './auth.js'

// ─── Provider setup ─────────────────────────────────────────────────────────

function createLLMProvider(): LLMProvider {
  const type = (process.env.QUOKKA_LLM_PROVIDER ?? 'openai') as ProviderConfig['type']
  const config: ProviderConfig = {
    type,
    apiKey: process.env.QUOKKA_LLM_API_KEY ?? process.env.OPENAI_API_KEY,
    baseUrl: process.env.QUOKKA_LLM_BASE_URL,
    model: process.env.QUOKKA_LLM_MODEL,
  }
  return createProvider(config)
}

/**
 * Wrap an LLMProvider as a ModelProvider (the simpler interface used by PlaywrightRunner).
 */
function asModelProvider(llm: LLMProvider): ModelProvider {
  return {
    async complete(prompt, options) {
      const messages = [
        ...(options?.system ? [{ role: 'system' as const, content: options.system }] : []),
        { role: 'user' as const, content: prompt },
      ]
      return llm.complete(messages, { temperature: options?.temperature })
    },
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const llmProvider = createLLMProvider()
  const modelProvider = asModelProvider(llmProvider)
  const sessionManager = new SessionManager()

  const server = new McpServer({
    name: 'quokka-mcp',
    version: '0.1.0',
  })

  // ── quokka_execute ──

  server.tool(
    'quokka_execute',
    'Execute a browser task from a natural language intent. Returns structured result with extracted data and artifacts.',
    {
      intent: z.string().describe('Natural language description of the browser task to execute'),
      url: z.string().url().optional().describe('Starting URL to navigate to before executing'),
      variables: z.record(z.string(), z.string()).optional().describe('Variables to inject into the task'),
      session_id: z.string().optional().describe('Reuse an existing browser session'),
    },
    async ({ intent, url, variables, session_id }) => {
      const result = await handleExecute(
        { intent, url, variables, session_id },
        sessionManager,
        modelProvider,
        llmProvider,
      )
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  // ── quokka_observe ──

  server.tool(
    'quokka_observe',
    'Navigate to a URL and answer a question about the page content using DOM observation.',
    {
      url: z.string().url().describe('URL of the page to observe'),
      question: z.string().describe('Question to answer about the page'),
      session_id: z.string().optional().describe('Reuse an existing browser session'),
    },
    async ({ url, question, session_id }) => {
      const result = await handleObserve(
        { url, question, session_id },
        sessionManager,
        llmProvider,
      )
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  // ── quokka_plan ──

  server.tool(
    'quokka_plan',
    'Plan a multi-step browser task by decomposing a goal into intent steps, without executing.',
    {
      goal: z.string().describe('High-level goal to decompose into browser automation steps'),
      start_url: z.string().url().describe('Starting URL for the task'),
    },
    async ({ goal, start_url }) => {
      const result = await handlePlan({ goal, start_url }, llmProvider)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  // ── Start server ──

  if (isAuthEnabled()) {
    console.error('[quokka-mcp] Auth enabled — QUOKKA_MCP_TOKEN is set')
  } else {
    console.error('[quokka-mcp] Auth disabled — running in local dev mode')
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[quokka-mcp] Server started on stdio')

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.error('[quokka-mcp] Shutting down...')
    await sessionManager.closeAll()
    await server.close()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await sessionManager.closeAll()
    await server.close()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[quokka-mcp] Fatal error:', err)
  process.exit(1)
})
