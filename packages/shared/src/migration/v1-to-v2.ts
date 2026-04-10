/**
 * Recipe migration: v1 (selector-based) → v2 (intent-based).
 *
 * Converts deterministic v1 steps into v2 ActionSteps with synthesized intents.
 * Navigate steps become page boundaries. The migration is lossy by design —
 * v2 replays use LLM planning, so exact selectors are not preserved.
 */

import type { Recipe, RecipeV2, RecipeV2Step } from '../types/index.js'

let _idCounter = 0
function nextId(): string {
  return `migrated_${++_idCounter}_${Math.random().toString(36).slice(2, 6)}`
}

/** Reset ID counter (for tests). */
export function resetMigrationCounter(): void {
  _idCounter = 0
}

/**
 * Migrate a v1 Recipe to v2 RecipeV2.
 *
 * Each v1 step becomes either:
 * - An ActionStep with a synthesized `intent` string
 * - A PageBoundary (for navigate steps)
 *
 * Conditional steps are flattened (thenSteps only) since v2 relies on
 * LLM planning rather than rule-based branching.
 */
export function migrateV1toV2(recipe: Recipe): RecipeV2 {
  const steps: RecipeV2Step[] = []

  function processStep(step: Recipe['steps'][number]): void {
    switch (step.type) {
      case 'click': {
        const label = describeLocator(step.target)
        steps.push({
          id: nextId(),
          type: 'action',
          intent: step.description ?? `Click ${label}`,
          context_hint: `v1 selector: ${step.target.css ?? step.target.text ?? ''}`,
          likelyNavigates: false,
        })
        break
      }
      case 'type': {
        const label = describeLocator(step.target)
        steps.push({
          id: nextId(),
          type: 'action',
          intent: step.description ?? `Type into ${label}`,
          context_hint: `v1 selector: ${step.target.css ?? step.target.text ?? ''}`,
          value: step.value,
          likelyNavigates: false,
        })
        break
      }
      case 'navigate': {
        // Navigate → page boundary + an action step
        steps.push({
          id: nextId(),
          type: 'action',
          intent: step.description ?? `Navigate to ${step.url}`,
          likelyNavigates: true,
        })
        steps.push({
          id: nextId(),
          type: 'page_boundary',
          expectedUrl: step.url,
          waitCondition: 'load',
        })
        break
      }
      case 'wait': {
        const label = describeLocator(step.target)
        steps.push({
          id: nextId(),
          type: 'action',
          intent: step.description ?? `Wait for ${label} to appear`,
          context_hint: `v1 selector: ${step.target.css ?? step.target.text ?? ''}`,
          likelyNavigates: false,
        })
        break
      }
      case 'extract': {
        const label = describeLocator(step.target)
        steps.push({
          id: nextId(),
          type: 'action',
          intent: step.description ?? `Extract data from ${label}`,
          context_hint: `v1 selector: ${step.target.css ?? step.target.text ?? ''}; save as: ${step.as}`,
          likelyNavigates: false,
        })
        break
      }
      case 'scroll': {
        const label = describeLocator(step.target)
        steps.push({
          id: nextId(),
          type: 'action',
          intent: step.description ?? `Scroll to ${label}`,
          context_hint: `v1 selector: ${step.target.css ?? step.target.text ?? ''}`,
          likelyNavigates: false,
        })
        break
      }
      case 'select': {
        const label = describeLocator(step.target)
        steps.push({
          id: nextId(),
          type: 'action',
          intent: step.description ?? `Select "${step.value}" in ${label}`,
          context_hint: `v1 selector: ${step.target.css ?? step.target.text ?? ''}`,
          value: step.value,
          likelyNavigates: false,
        })
        break
      }
      case 'hover': {
        const label = describeLocator(step.target)
        steps.push({
          id: nextId(),
          type: 'action',
          intent: step.description ?? `Hover over ${label}`,
          context_hint: `v1 selector: ${step.target.css ?? step.target.text ?? ''}`,
          likelyNavigates: false,
        })
        break
      }
      case 'checkpoint': {
        steps.push({
          id: nextId(),
          type: 'action',
          intent: step.description ?? `Checkpoint: ${step.message}`,
          verification: step.message,
          likelyNavigates: false,
        })
        break
      }
      case 'conditional': {
        // Flatten: include thenSteps only (v2 handles branching via LLM)
        if (step.thenSteps) {
          for (const s of step.thenSteps) {
            processStep(s as Recipe['steps'][number])
          }
        }
        break
      }
    }
  }

  for (const step of recipe.steps) {
    processStep(step)
  }

  return {
    version: '2.0',
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    intent: recipe.description ?? `Automated: ${recipe.name}`,
    steps,
    variables: recipe.slots?.reduce(
      (acc, slot) => {
        acc[slot.key] = slot.default ?? ''
        return acc
      },
      {} as Record<string, string>,
    ),
    hosts: recipe.hosts,
    meta: {
      createdFrom: 'import',
      tags: recipe.meta?.tags,
      author: recipe.meta?.author,
    },
    createdAt: recipe.createdAt,
    updatedAt: new Date().toISOString(),
  }
}

function describeLocator(target: { css?: string; text?: string; ariaLabel?: string; testId?: string }): string {
  if (target.ariaLabel) return `"${target.ariaLabel}"`
  if (target.text) return `"${target.text}"`
  if (target.testId) return target.testId.replace(/[-_]/g, ' ')
  if (target.css) {
    const aria = target.css.match(/\[aria-label="([^"]+)"\]/)
    if (aria) return `"${aria[1]}"`
    const id = target.css.match(/^#([\w-]+)$/)
    if (id) return id[1].replace(/[-_]/g, ' ')
    return `element (${target.css.slice(0, 40)})`
  }
  return 'an element'
}
