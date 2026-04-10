import { describe, it, expect } from 'vitest'
import { StepSchema, RecipeSchema, ConditionSchema } from '../index.js'

describe('ConditionSchema', () => {
  it('validates element_exists condition', () => {
    const result = ConditionSchema.safeParse({
      type: 'element_exists',
      target: { css: '#login-btn' },
    })
    expect(result.success).toBe(true)
  })

  it('validates element_not_exists condition', () => {
    const result = ConditionSchema.safeParse({
      type: 'element_not_exists',
      target: { css: '.error' },
    })
    expect(result.success).toBe(true)
  })

  it('validates url_matches condition', () => {
    const result = ConditionSchema.safeParse({
      type: 'url_matches',
      pattern: '/dashboard',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid condition type', () => {
    const result = ConditionSchema.safeParse({
      type: 'invalid_condition',
      target: { css: '#x' },
    })
    expect(result.success).toBe(false)
  })
})

describe('StepSchema — conditional', () => {
  it('validates a conditional step with thenSteps', () => {
    const result = StepSchema.safeParse({
      type: 'conditional',
      condition: { type: 'element_exists', target: { css: '#popup' } },
      thenSteps: [{ type: 'click', target: { css: '#dismiss' } }],
    })
    expect(result.success).toBe(true)
  })

  it('validates a conditional step with thenSteps and elseSteps', () => {
    const result = StepSchema.safeParse({
      type: 'conditional',
      condition: { type: 'element_exists', target: { css: '#logged-in' } },
      thenSteps: [{ type: 'click', target: { css: '#dashboard' } }],
      elseSteps: [{ type: 'navigate', url: '/login' }],
      description: 'Check if logged in',
    })
    expect(result.success).toBe(true)
  })

  it('validates nested conditional steps', () => {
    const result = StepSchema.safeParse({
      type: 'conditional',
      condition: { type: 'url_matches', pattern: '/settings' },
      thenSteps: [
        {
          type: 'conditional',
          condition: { type: 'element_exists', target: { css: '.advanced-toggle' } },
          thenSteps: [{ type: 'click', target: { css: '.advanced-toggle' } }],
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects conditional step without condition', () => {
    const result = StepSchema.safeParse({
      type: 'conditional',
      thenSteps: [{ type: 'click', target: { css: '#x' } }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects conditional step without thenSteps', () => {
    const result = StepSchema.safeParse({
      type: 'conditional',
      condition: { type: 'element_exists', target: { css: '#x' } },
    })
    expect(result.success).toBe(false)
  })
})

describe('RecipeSchema — with conditional steps', () => {
  it('parses a recipe containing conditional steps', () => {
    const recipe = {
      id: 'recipe-cond',
      name: 'Conditional Recipe',
      version: '0.1.0',
      hosts: ['example.com'],
      slots: [],
      guards: [],
      steps: [
        { type: 'navigate', url: 'https://example.com' },
        {
          type: 'conditional',
          condition: { type: 'element_exists', target: { css: '.cookie-banner' } },
          thenSteps: [{ type: 'click', target: { css: '.accept-cookies' } }],
          description: 'Dismiss cookie banner if present',
        },
        { type: 'click', target: { css: '#main-cta' } },
      ],
      meta: { createdFrom: 'code' as const, tags: [] },
    }

    const result = RecipeSchema.safeParse(recipe)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.steps).toHaveLength(3)
      expect(result.data.steps[1].type).toBe('conditional')
    }
  })
})
