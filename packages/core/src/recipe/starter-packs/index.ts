import type { Pack, Recipe } from '@quokka/shared'

export { hrRecipes, hrPack } from './hr.js'
export { salesRecipes, salesPack } from './sales.js'
export { supportRecipes, supportPack } from './support.js'
export { socialMediaRecipes, socialMediaPack } from './social-media.js'
export { dataEntryRecipes, dataEntryPack } from './data-entry.js'

import { hrRecipes, hrPack } from './hr.js'
import { salesRecipes, salesPack } from './sales.js'
import { supportRecipes, supportPack } from './support.js'
import { socialMediaRecipes, socialMediaPack } from './social-media.js'
import { dataEntryRecipes, dataEntryPack } from './data-entry.js'

/** All starter pack definitions */
export const starterPacks: Pack[] = [
  hrPack,
  salesPack,
  supportPack,
  socialMediaPack,
  dataEntryPack,
]

/** All recipes across all starter packs */
export const starterRecipes: Recipe[] = [
  ...hrRecipes,
  ...salesRecipes,
  ...supportRecipes,
  ...socialMediaRecipes,
  ...dataEntryRecipes,
]
