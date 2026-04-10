import { nanoid } from 'nanoid'
import type { Recipe, Step, Slot } from '@quokka/shared'
import type { WatchTrace } from './types.js'
import { deduplicateTrace } from './dedup.js'
import { refineSelector } from './selector.js'
import { inferSlots } from './slots.js'

export interface CompileOptions {
  name?: string
}

/**
 * Main compilation pipeline:
 * dedup → refine selectors → infer slots → assemble Recipe
 */
export function compileTrace(
  trace: WatchTrace,
  options?: CompileOptions,
): Recipe {
  // Step 1: Deduplicate
  const deduped = deduplicateTrace(trace)

  // Step 2: Refine selectors
  const refined = deduped.map((entry) => ({
    ...entry,
    selector: refineSelector(entry.selector, entry),
  }))

  // Step 3: Infer slots
  const inferredSlots = inferSlots(refined)

  // Step 4: Extract unique hosts from URLs
  const hosts = [
    ...new Set(
      refined
        .map((e) => {
          try {
            return new URL(e.url).hostname
          } catch {
            return null
          }
        })
        .filter((h): h is string => h !== null),
    ),
  ]

  // Step 5: Build slots array for Recipe
  const slots: Slot[] = inferredSlots.map((s) => ({
    key: s.key,
    label: s.label,
    type: s.key === 'date' ? 'date' : 'string',
  }))

  // Step 6: Convert trace entries to Recipe steps
  const steps: Step[] = refined.map((entry) => {
    switch (entry.action) {
      case 'click':
        return {
          type: 'click' as const,
          target: { css: entry.selector },
          description: entry.textContent
            ? `Click ${entry.textContent}`
            : undefined,
        }
      case 'type': {
        // Check if this entry's value is a slot
        let value = entry.value ?? ''
        for (const slot of inferredSlots) {
          const idx = refined.indexOf(entry)
          if (slot.indices.includes(idx)) {
            value = `{{${slot.key}}}`
            break
          }
        }
        return {
          type: 'type' as const,
          target: { css: entry.selector },
          value,
          description: entry.textContent
            ? `Type into ${entry.textContent}`
            : undefined,
        }
      }
      case 'navigate':
        return {
          type: 'navigate' as const,
          url: entry.url,
          description: `Navigate to ${entry.url}`,
        }
      case 'scroll':
        // Scroll maps to a wait step (wait for target to be visible)
        return {
          type: 'wait' as const,
          target: { css: entry.selector },
          description: 'Scroll to element',
        }
    }
  })

  // Step 7: Assemble Recipe
  const recipe: Recipe = {
    id: nanoid(),
    name: options?.name ?? 'Untitled Recipe',
    version: '0.1.0',
    hosts,
    slots,
    guards: [],
    steps,
    meta: {
      createdFrom: 'watch',
      tags: [],
    },
  }

  return recipe
}
