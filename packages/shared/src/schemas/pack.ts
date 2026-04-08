import { z } from 'zod'

export const PackSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  recipeIds: z.array(z.string()),
})
