import { describe, it, expect } from 'vitest'
import { reorderSteps, deleteStep, updateStep } from '../lib/timeline-helpers'
import type { Step } from '@quokka/shared'

function makeStep(type: Step['type'], description: string): Step {
  switch (type) {
    case 'navigate':
      return { type: 'navigate', url: 'https://example.com', description }
    case 'click':
      return { type: 'click', target: { css: '.btn' }, description }
    case 'type':
      return { type: 'type', target: { css: 'input' }, value: 'hello', description }
    case 'wait':
      return { type: 'wait', target: { css: '.loader' }, description }
    case 'extract':
      return { type: 'extract', target: { css: '.data' }, as: 'result', description }
    case 'checkpoint':
      return { type: 'checkpoint', message: 'check', description }
    default:
      return { type: 'click', target: { css: '.btn' }, description }
  }
}

describe('reorderSteps', () => {
  const steps: Step[] = [
    makeStep('navigate', 'step-0'),
    makeStep('click', 'step-1'),
    makeStep('type', 'step-2'),
    makeStep('wait', 'step-3'),
  ]

  it('moves a step forward', () => {
    const result = reorderSteps(steps, 0, 2)
    expect(result.map((s) => s.description)).toEqual(['step-1', 'step-2', 'step-0', 'step-3'])
  })

  it('moves a step backward', () => {
    const result = reorderSteps(steps, 3, 1)
    expect(result.map((s) => s.description)).toEqual(['step-0', 'step-3', 'step-1', 'step-2'])
  })

  it('returns same array for same index', () => {
    const result = reorderSteps(steps, 1, 1)
    expect(result).toBe(steps)
  })

  it('returns same array for out-of-bounds fromIndex', () => {
    expect(reorderSteps(steps, -1, 2)).toBe(steps)
    expect(reorderSteps(steps, 10, 2)).toBe(steps)
  })

  it('returns same array for out-of-bounds toIndex', () => {
    expect(reorderSteps(steps, 0, -1)).toBe(steps)
    expect(reorderSteps(steps, 0, 10)).toBe(steps)
  })

  it('does not mutate the original array', () => {
    const original = [...steps]
    reorderSteps(steps, 0, 2)
    expect(steps).toEqual(original)
  })
})

describe('deleteStep', () => {
  const steps: Step[] = [
    makeStep('navigate', 'step-0'),
    makeStep('click', 'step-1'),
    makeStep('type', 'step-2'),
  ]

  it('removes the step at given index', () => {
    const result = deleteStep(steps, 1)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.description)).toEqual(['step-0', 'step-2'])
  })

  it('removes first step', () => {
    const result = deleteStep(steps, 0)
    expect(result.map((s) => s.description)).toEqual(['step-1', 'step-2'])
  })

  it('removes last step', () => {
    const result = deleteStep(steps, 2)
    expect(result.map((s) => s.description)).toEqual(['step-0', 'step-1'])
  })

  it('returns same array for out-of-bounds index', () => {
    expect(deleteStep(steps, -1)).toBe(steps)
    expect(deleteStep(steps, 5)).toBe(steps)
  })

  it('does not mutate the original array', () => {
    const original = [...steps]
    deleteStep(steps, 1)
    expect(steps).toEqual(original)
  })
})

describe('updateStep', () => {
  const steps: Step[] = [
    makeStep('navigate', 'step-0'),
    makeStep('click', 'step-1'),
    makeStep('type', 'step-2'),
  ]

  it('replaces the step at given index', () => {
    const newStep = makeStep('extract', 'replaced')
    const result = updateStep(steps, 1, newStep)
    expect(result[1]).toBe(newStep)
    expect(result[0].description).toBe('step-0')
    expect(result[2].description).toBe('step-2')
  })

  it('returns same array for out-of-bounds index', () => {
    const newStep = makeStep('click', 'x')
    expect(updateStep(steps, -1, newStep)).toBe(steps)
    expect(updateStep(steps, 10, newStep)).toBe(steps)
  })

  it('does not mutate the original array', () => {
    const original = [...steps]
    updateStep(steps, 0, makeStep('click', 'new'))
    expect(steps).toEqual(original)
  })

  it('preserves array length', () => {
    const result = updateStep(steps, 0, makeStep('wait', 'new'))
    expect(result).toHaveLength(steps.length)
  })
})
