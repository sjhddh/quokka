import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { PlaywrightRunner, capturePlaywrightSnapshot } from '@quokka/runner-playwright'
import { RecipeV2Schema } from '@quokka/shared'
import type { LLMProvider } from '@quokka/core'
import { chromium, type Browser, type Page } from 'playwright'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface QuokkaToolConfig {
  /** LLM provider for observe/plan tools */
  provider?: LLMProvider
  /** Browser launch options */
  headless?: boolean
  /** Per-action timeout in ms (default: 30000) */
  timeout?: number
  /** Viewport size */
  viewport?: { width: number; height: number }
}

async function launchBrowser(config: QuokkaToolConfig): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({ headless: config.headless ?? true })
  const page = await browser.newPage({
    viewport: config.viewport ?? { width: 1280, height: 720 },
  })
  if (config.timeout) page.setDefaultTimeout(config.timeout)
  return { browser, page }
}

// ---------------------------------------------------------------------------
// QuokkaExecuteTool
// ---------------------------------------------------------------------------

export class QuokkaExecuteTool extends StructuredTool {
  name = 'quokka_execute'
  description =
    'Execute a browser automation task. Provide a natural-language intent ' +
    'and a starting URL. Returns the execution result including status and ' +
    'number of steps executed.'

  schema = z.object({
    intent: z.string().describe('Natural-language description of what to do in the browser'),
    url: z.string().url().describe('Starting URL to navigate to'),
    variables: z
      .record(z.string(), z.string())
      .optional()
      .describe('Key-value variables to inject into the recipe'),
  })

  private config: QuokkaToolConfig

  constructor(config: QuokkaToolConfig = {}) {
    super()
    this.config = config
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const recipe = RecipeV2Schema.parse({
      version: '2.0',
      id: `langchain-exec-${Date.now()}`,
      name: 'LangChain Execute',
      intent: input.intent,
      steps: [
        {
          id: 'step-1',
          type: 'action',
          intent: input.intent,
          likelyNavigates: true,
        },
      ],
      hosts: [new URL(input.url).hostname],
    })

    const runner = new PlaywrightRunner({
      headless: this.config.headless ?? true,
      timeout: this.config.timeout,
      viewport: this.config.viewport,
    })

    try {
      const result = await runner.run(
        recipe,
        { ...input.variables, __startUrl: input.url },
        this.config.provider!,
      )
      return JSON.stringify(result, null, 2)
    } finally {
      await runner.close()
    }
  }
}

// ---------------------------------------------------------------------------
// QuokkaObserveTool
// ---------------------------------------------------------------------------

export class QuokkaObserveTool extends StructuredTool {
  name = 'quokka_observe'
  description =
    'Navigate to a URL, capture a DOM snapshot of the page, and answer a ' +
    'question about what is visible. Returns the LLM answer based on the ' +
    'live page content.'

  schema = z.object({
    url: z.string().url().describe('URL to navigate to and observe'),
    question: z.string().describe('Question to answer about the page content'),
  })

  private config: QuokkaToolConfig

  constructor(config: QuokkaToolConfig = {}) {
    super()
    this.config = config
    if (!config.provider) {
      throw new Error('QuokkaObserveTool requires an LLMProvider in config')
    }
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const { browser, page } = await launchBrowser(this.config)

    try {
      await page.goto(input.url, { waitUntil: 'domcontentloaded' })
      const snapshot = await capturePlaywrightSnapshot(page)

      const answer = await this.config.provider!.complete([
        {
          role: 'system',
          content:
            'You are analyzing a web page. Answer the user question based on ' +
            'the following DOM snapshot.\n\n' +
            `URL: ${snapshot.url}\nTitle: ${snapshot.title}\n\n` +
            'Accessibility tree:\n' +
            snapshot.accessibilityTree
              .map((n) => `[${n.role}] "${n.name}" (${n.selector})`)
              .join('\n'),
        },
        { role: 'user', content: input.question },
      ])

      return JSON.stringify({ url: snapshot.url, title: snapshot.title, answer })
    } finally {
      await page.close()
      await browser.close()
    }
  }
}

// ---------------------------------------------------------------------------
// QuokkaPlanTool
// ---------------------------------------------------------------------------

export class QuokkaPlanTool extends StructuredTool {
  name = 'quokka_plan'
  description =
    'Decompose a high-level browser automation goal into a sequence of ' +
    'concrete steps. Returns a RecipeV2 JSON with ordered action steps.'

  schema = z.object({
    goal: z.string().describe('High-level goal to decompose into browser steps'),
    url: z.string().url().describe('Starting URL for the task'),
    maxSteps: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(10)
      .describe('Maximum number of steps to generate (default: 10)'),
  })

  private config: QuokkaToolConfig

  constructor(config: QuokkaToolConfig = {}) {
    super()
    this.config = config
    if (!config.provider) {
      throw new Error('QuokkaPlanTool requires an LLMProvider in config')
    }
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = this.config.provider!

    const response = await provider.completeJSON<{
      steps: Array<{ intent: string; context_hint?: string; likelyNavigates: boolean }>
    }>(
      [
        {
          role: 'system',
          content:
            'You are a browser automation planner. Given a goal and starting URL, ' +
            'decompose it into concrete sequential steps. Each step should be a ' +
            'single user-visible action (click, type, navigate, etc.).',
        },
        {
          role: 'user',
          content:
            `Goal: ${input.goal}\nStarting URL: ${input.url}\n` +
            `Generate up to ${input.maxSteps} steps.`,
        },
      ],
      {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                intent: { type: 'string' },
                context_hint: { type: 'string' },
                likelyNavigates: { type: 'boolean' },
              },
              required: ['intent', 'likelyNavigates'],
            },
          },
        },
        required: ['steps'],
      },
    )

    const recipe = RecipeV2Schema.parse({
      version: '2.0',
      id: `langchain-plan-${Date.now()}`,
      name: `Plan: ${input.goal.slice(0, 60)}`,
      description: input.goal,
      intent: input.goal,
      steps: response.steps.map((s, i) => ({
        id: `step-${i + 1}`,
        type: 'action' as const,
        intent: s.intent,
        context_hint: s.context_hint,
        likelyNavigates: s.likelyNavigates,
      })),
      hosts: [new URL(input.url).hostname],
    })

    return JSON.stringify(recipe, null, 2)
  }
}
