import type { Step } from '@quokka/shared'

/** Move a step from one index to another, returning a new array. */
export function reorderSteps(steps: Step[], fromIndex: number, toIndex: number): Step[] {
  if (
    fromIndex < 0 ||
    fromIndex >= steps.length ||
    toIndex < 0 ||
    toIndex >= steps.length ||
    fromIndex === toIndex
  ) {
    return steps
  }
  const result = [...steps]
  const [moved] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, moved)
  return result
}

/** Remove a step at the given index, returning a new array. */
export function deleteStep(steps: Step[], index: number): Step[] {
  if (index < 0 || index >= steps.length) {
    return steps
  }
  return steps.filter((_, i) => i !== index)
}

/** Replace the step at the given index with a new step, returning a new array. */
export function updateStep(steps: Step[], index: number, updated: Step): Step[] {
  if (index < 0 || index >= steps.length) {
    return steps
  }
  return steps.map((s, i) => (i === index ? updated : s))
}
