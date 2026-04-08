import { describe, it, expect } from 'vitest'
import { RecipeSchema } from '@quokka/shared'
import { compileTrace } from '../compiler.js'
import type { WatchTrace } from '../types.js'

const sampleTrace: WatchTrace = [
  {
    action: 'navigate',
    selector: '',
    url: 'https://example.com/login',
    timestamp: 1000,
  },
  {
    action: 'click',
    selector: '#email-input',
    url: 'https://example.com/login',
    timestamp: 2000,
    tagName: 'INPUT',
    textContent: 'Email',
  },
  {
    action: 'type',
    selector: '#email-input',
    value: 'user@example.com',
    url: 'https://example.com/login',
    timestamp: 3000,
    tagName: 'INPUT',
  },
  {
    action: 'type',
    selector: '#name-field',
    value: 'John Smith',
    url: 'https://example.com/login',
    timestamp: 4000,
    tagName: 'INPUT',
  },
  {
    action: 'click',
    selector: '[data-testid="submit-btn"]',
    url: 'https://example.com/login',
    timestamp: 5000,
    tagName: 'BUTTON',
    textContent: 'Submit',
  },
]

describe('compileTrace', () => {
  it('produces a valid Recipe from a 5-action trace', () => {
    const recipe = compileTrace(sampleTrace, { name: 'Login Flow' })

    const result = RecipeSchema.safeParse(recipe)
    expect(result.success).toBe(true)
  })

  it('generates correct step types', () => {
    const recipe = compileTrace(sampleTrace, { name: 'Login Flow' })

    expect(recipe.steps[0].type).toBe('navigate')
    expect(recipe.steps[1].type).toBe('click')
    expect(recipe.steps[2].type).toBe('type')
    expect(recipe.steps[3].type).toBe('type')
    expect(recipe.steps[4].type).toBe('click')
  })

  it('sets meta.createdFrom to "watch"', () => {
    const recipe = compileTrace(sampleTrace)
    expect(recipe.meta.createdFrom).toBe('watch')
  })

  it('extracts hosts from trace URLs', () => {
    const recipe = compileTrace(sampleTrace)
    expect(recipe.hosts).toContain('example.com')
    expect(recipe.hosts).toHaveLength(1)
  })

  it('infers email slot from typed values', () => {
    const recipe = compileTrace(sampleTrace)
    const emailSlot = recipe.slots.find((s) => s.key === 'email')
    expect(emailSlot).toBeDefined()
    expect(emailSlot!.label).toBe('Email Address')
  })

  it('infers name slot from typed values', () => {
    const recipe = compileTrace(sampleTrace)
    const nameSlot = recipe.slots.find((s) => s.key === 'name')
    expect(nameSlot).toBeDefined()
    expect(nameSlot!.label).toBe('Full Name')
  })

  it('replaces slot values with template placeholders in steps', () => {
    const recipe = compileTrace(sampleTrace)
    const typeSteps = recipe.steps.filter((s) => s.type === 'type')
    const emailStep = typeSteps.find(
      (s) => s.type === 'type' && s.value === '{{email}}',
    )
    expect(emailStep).toBeDefined()
  })

  it('has a generated id', () => {
    const recipe = compileTrace(sampleTrace)
    expect(recipe.id).toBeTruthy()
    expect(typeof recipe.id).toBe('string')
  })
})
