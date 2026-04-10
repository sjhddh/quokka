import { describe, it, expect } from 'vitest'
import { RecipeSchema, PackSchema } from '@quokka/shared'
import { starterPacks, starterRecipes } from '../recipe/starter-packs/index.js'
import { hrRecipes, hrPack } from '../recipe/starter-packs/hr.js'
import { salesRecipes, salesPack } from '../recipe/starter-packs/sales.js'
import { supportRecipes, supportPack } from '../recipe/starter-packs/support.js'
import { socialMediaRecipes, socialMediaPack } from '../recipe/starter-packs/social-media.js'
import { dataEntryRecipes, dataEntryPack } from '../recipe/starter-packs/data-entry.js'

describe('starter pack recipes validate against RecipeSchema', () => {
  for (const recipe of starterRecipes) {
    it(`${recipe.id} is a valid recipe`, () => {
      const result = RecipeSchema.safeParse(recipe)
      if (!result.success) {
        console.error(result.error.format())
      }
      expect(result.success).toBe(true)
    })
  }
})

describe('starter packs validate against PackSchema', () => {
  for (const pack of starterPacks) {
    it(`${pack.id} is a valid pack`, () => {
      const result = PackSchema.safeParse(pack)
      if (!result.success) {
        console.error(result.error.format())
      }
      expect(result.success).toBe(true)
    })
  }
})

describe('no duplicate recipe IDs', () => {
  it('all recipe IDs are unique', () => {
    const ids = starterRecipes.map((r) => r.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('all pack IDs are unique', () => {
    const ids = starterPacks.map((p) => p.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

describe('all recipes have at least 2 steps', () => {
  for (const recipe of starterRecipes) {
    it(`${recipe.id} has >= 2 steps`, () => {
      expect(recipe.steps.length).toBeGreaterThanOrEqual(2)
    })
  }
})

describe('pack recipeIds match exported recipes', () => {
  it('HR pack references all HR recipes', () => {
    for (const r of hrRecipes) {
      expect(hrPack.recipeIds).toContain(r.id)
    }
  })

  it('Sales pack references all Sales recipes', () => {
    for (const r of salesRecipes) {
      expect(salesPack.recipeIds).toContain(r.id)
    }
  })

  it('Support pack references all Support recipes', () => {
    for (const r of supportRecipes) {
      expect(supportPack.recipeIds).toContain(r.id)
    }
  })

  it('Social Media pack references all Social Media recipes', () => {
    for (const r of socialMediaRecipes) {
      expect(socialMediaPack.recipeIds).toContain(r.id)
    }
  })

  it('Data Entry pack references all Data Entry recipes', () => {
    for (const r of dataEntryRecipes) {
      expect(dataEntryPack.recipeIds).toContain(r.id)
    }
  })
})

describe('starter packs completeness', () => {
  it('has exactly 5 packs', () => {
    expect(starterPacks).toHaveLength(5)
  })

  it('has 15 total recipes (3 per pack)', () => {
    expect(starterRecipes).toHaveLength(15)
  })

  it('every recipe has hosts defined', () => {
    for (const recipe of starterRecipes) {
      expect(recipe.hosts.length).toBeGreaterThan(0)
    }
  })

  it('every recipe has at least one slot', () => {
    for (const recipe of starterRecipes) {
      expect(recipe.slots.length).toBeGreaterThan(0)
    }
  })

  it('every recipe has at least one guard', () => {
    for (const recipe of starterRecipes) {
      expect(recipe.guards.length).toBeGreaterThan(0)
    }
  })

  it('every recipe has tags including "starter"', () => {
    for (const recipe of starterRecipes) {
      expect(recipe.meta.tags).toContain('starter')
    }
  })
})
