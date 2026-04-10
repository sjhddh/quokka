import { describe, it, expect } from 'vitest'
import { RecipeSchema } from '@quokka/shared'
import { recipe } from '../recipe/builder.js'

describe('RecipeBuilder', () => {
  it('builds a valid recipe that passes RecipeSchema', () => {
    const r = recipe('extract-links')
      .hosts('example.com')
      .slot('url', 'Target URL', 'string')
      .step('navigate', { url: '{{url}}' })
      .step('extract', { target: { css: 'a' }, as: 'links' })
      .checkpoint('Extracted links — continue?')
      .build()

    expect(r.name).toBe('extract-links')
    expect(r.hosts).toEqual(['example.com'])
    expect(r.slots).toHaveLength(1)
    expect(r.slots[0].key).toBe('url')
    expect(r.steps).toHaveLength(3)
    expect(r.steps[0].type).toBe('navigate')
    expect(r.steps[1].type).toBe('extract')
    expect(r.steps[2].type).toBe('checkpoint')

    // Validate against Zod schema
    const parsed = RecipeSchema.parse(r)
    expect(parsed.id).toBe(r.id)
    expect(parsed.steps).toHaveLength(3)
  })

  it('supports description and tags', () => {
    const r = recipe('test')
      .description('A test recipe')
      .hosts('test.com')
      .tags('demo', 'test')
      .step('click', { target: { css: '#btn' } })
      .build()

    const parsed = RecipeSchema.parse(r)
    expect(parsed.description).toBe('A test recipe')
    expect(parsed.meta.tags).toEqual(['demo', 'test'])
  })

  it('supports slot with default value', () => {
    const r = recipe('with-default')
      .hosts('example.com')
      .slot('query', 'Search query', 'string', 'hello')
      .step('navigate', { url: 'https://example.com?q={{query}}' })
      .build()

    const parsed = RecipeSchema.parse(r)
    expect(parsed.slots[0].default).toBe('hello')
  })
})
