import { describe, it, expect } from 'vitest'
import { transition } from '../state-machine.js'

describe('transition', () => {
  it('idle + start → planning', () => {
    expect(transition('idle', 'start')).toBe('planning')
  })

  it('planning + plan_complete → running', () => {
    expect(transition('planning', 'plan_complete')).toBe('running')
  })

  it('running + checkpoint → checkpoint_wait', () => {
    expect(transition('running', 'checkpoint')).toBe('checkpoint_wait')
  })

  it('checkpoint_wait + approve → running', () => {
    expect(transition('checkpoint_wait', 'approve')).toBe('running')
  })

  it('checkpoint_wait + reject → failed', () => {
    expect(transition('checkpoint_wait', 'reject')).toBe('failed')
  })

  it('running + complete → completed', () => {
    expect(transition('running', 'complete')).toBe('completed')
  })

  it('any state + error → failed', () => {
    expect(transition('idle', 'error')).toBe('failed')
    expect(transition('planning', 'error')).toBe('failed')
    expect(transition('running', 'error')).toBe('failed')
    expect(transition('checkpoint_wait', 'error')).toBe('failed')
  })

  it('throws on invalid transition', () => {
    expect(() => transition('idle', 'complete')).toThrow('Invalid transition')
    expect(() => transition('completed', 'start')).toThrow('Invalid transition')
    expect(() => transition('failed', 'start')).toThrow('Invalid transition')
    expect(() => transition('planning', 'approve')).toThrow('Invalid transition')
  })
})
