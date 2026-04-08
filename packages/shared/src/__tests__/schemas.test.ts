import { describe, it, expect } from 'vitest'
import { RecipeSchema, RunSchema, RunEventSchema } from '../index.js'

describe('RecipeSchema', () => {
  const validRecipe = {
    id: 'recipe-001',
    name: 'Login to Dashboard',
    description: 'Automates login flow',
    version: '0.1.0',
    hosts: ['https://app.example.com'],
    slots: [
      { key: 'username', label: 'Username', type: 'string' as const },
      { key: 'password', label: 'Password', type: 'string' as const },
    ],
    guards: [
      { type: 'url' as const, expect: 'https://app.example.com/dashboard' },
    ],
    steps: [
      {
        type: 'navigate' as const,
        url: 'https://app.example.com/login',
        description: 'Go to login page',
      },
      {
        type: 'type' as const,
        target: { css: '#username' },
        value: '{{username}}',
      },
      {
        type: 'type' as const,
        target: { css: '#password' },
        value: '{{password}}',
      },
      {
        type: 'click' as const,
        target: { css: 'button[type="submit"]' },
        description: 'Click login button',
      },
      {
        type: 'wait' as const,
        target: { css: '.dashboard' },
        timeout: 10000,
      },
      {
        type: 'extract' as const,
        target: { css: '.welcome-message' },
        as: 'greeting',
      },
      {
        type: 'checkpoint' as const,
        message: 'Verify you are logged in',
      },
    ],
    meta: {
      createdFrom: 'prompt' as const,
      tags: ['auth', 'login'],
    },
  }

  it('should parse a valid recipe', () => {
    const result = RecipeSchema.safeParse(validRecipe)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Login to Dashboard')
      expect(result.data.steps).toHaveLength(7)
      expect(result.data.meta.createdFrom).toBe('prompt')
    }
  })

  it('should reject a recipe missing name', () => {
    const { name, ...missingName } = validRecipe
    const result = RecipeSchema.safeParse(missingName)
    expect(result.success).toBe(false)
  })

  it('should apply default version', () => {
    const { version, ...noVersion } = validRecipe
    const result = RecipeSchema.safeParse(noVersion)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.version).toBe('0.1.0')
    }
  })
})

describe('RunSchema', () => {
  it('should parse a valid run', () => {
    const validRun = {
      id: 'run-001',
      recipeId: 'recipe-001',
      status: 'running',
      slotValues: { username: 'admin', password: 'secret' },
      currentStepIndex: 2,
      startedAt: '2025-01-15T10:00:00Z',
    }

    const result = RunSchema.safeParse(validRun)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('running')
      expect(result.data.currentStepIndex).toBe(2)
    }
  })

  it('should apply default currentStepIndex', () => {
    const run = {
      id: 'run-002',
      recipeId: 'recipe-001',
      status: 'idle',
      slotValues: {},
    }

    const result = RunSchema.safeParse(run)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currentStepIndex).toBe(0)
    }
  })
})

describe('RunEventSchema', () => {
  it('should parse valid events', () => {
    const events = [
      {
        id: 'evt-001',
        runId: 'run-001',
        type: 'run_started',
        timestamp: '2025-01-15T10:00:00Z',
      },
      {
        id: 'evt-002',
        runId: 'run-001',
        type: 'step_started',
        stepIndex: 0,
        timestamp: '2025-01-15T10:00:01Z',
      },
      {
        id: 'evt-003',
        runId: 'run-001',
        type: 'step_succeeded',
        stepIndex: 0,
        payload: { extracted: 'Welcome, admin!' },
        timestamp: '2025-01-15T10:00:02Z',
      },
      {
        id: 'evt-004',
        runId: 'run-001',
        type: 'checkpoint_required',
        stepIndex: 6,
        payload: { message: 'Verify you are logged in' },
        timestamp: '2025-01-15T10:00:05Z',
      },
      {
        id: 'evt-005',
        runId: 'run-001',
        type: 'run_completed',
        timestamp: '2025-01-15T10:00:10Z',
      },
    ]

    for (const event of events) {
      const result = RunEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    }
  })

  it('should reject event with invalid type', () => {
    const badEvent = {
      id: 'evt-bad',
      runId: 'run-001',
      type: 'invalid_type',
      timestamp: '2025-01-15T10:00:00Z',
    }

    const result = RunEventSchema.safeParse(badEvent)
    expect(result.success).toBe(false)
  })
})
