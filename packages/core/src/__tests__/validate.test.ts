import { describe, it, expect } from 'vitest'
import { RecipeSchema, PackSchema } from '@quokka/shared'
import { extractLinksRecipe } from '../recipe/extract-links.js'
import { fillFormRecipe } from '../recipe/fill-form.js'
import { exportTableRecipe } from '../recipe/export-table.js'
import { gettingStartedPack } from '../recipe/getting-started.js'

describe('starter pack recipes validate against RecipeSchema', () => {
  it('extract-links recipe is valid', () => {
    const result = RecipeSchema.safeParse(extractLinksRecipe)
    expect(result.success).toBe(true)
  })

  it('fill-form recipe is valid', () => {
    const result = RecipeSchema.safeParse(fillFormRecipe)
    expect(result.success).toBe(true)
  })

  it('export-table recipe is valid', () => {
    const result = RecipeSchema.safeParse(exportTableRecipe)
    expect(result.success).toBe(true)
  })
})

describe('getting-started pack validates against PackSchema', () => {
  it('pack is valid', () => {
    const result = PackSchema.safeParse(gettingStartedPack)
    expect(result.success).toBe(true)
  })

  it('pack references all starter recipes', () => {
    expect(gettingStartedPack.recipeIds).toContain(extractLinksRecipe.id)
    expect(gettingStartedPack.recipeIds).toContain(fillFormRecipe.id)
    expect(gettingStartedPack.recipeIds).toContain(exportTableRecipe.id)
  })
})
