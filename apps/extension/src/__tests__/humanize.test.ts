import { describe, it, expect } from 'vitest'
import { humanizeStep, humanizeError, type HumanizeStepInput } from '../lib/messaging'

describe('humanizeStep', () => {
  it('describes a click step with ariaLabel', () => {
    const step: HumanizeStepInput = {
      type: 'click',
      target: { ariaLabel: 'Sign In' },
    }
    expect(humanizeStep(step)).toBe('Clicked the "Sign In"')
  })

  it('describes a click step with text target', () => {
    const step: HumanizeStepInput = {
      type: 'click',
      target: { text: 'Login' },
    }
    expect(humanizeStep(step)).toBe('Clicked the "Login"')
  })

  it('describes a click step with CSS selector', () => {
    const step: HumanizeStepInput = {
      type: 'click',
      target: { css: '#submit-btn' },
    }
    expect(humanizeStep(step)).toBe('Clicked the submit btn')
  })

  it('describes a click step with no useful target', () => {
    const step: HumanizeStepInput = {
      type: 'click',
      target: { css: 'div.complex > span:nth-child(2)' },
    }
    expect(humanizeStep(step)).toBe('Clicked an element')
  })

  it('describes a type step', () => {
    const step: HumanizeStepInput = {
      type: 'type',
      target: { ariaLabel: 'Email' },
      value: 'user@example.com',
    }
    expect(humanizeStep(step)).toBe('Typed "user@example.com" into "Email"')
  })

  it('truncates long type values', () => {
    const step: HumanizeStepInput = {
      type: 'type',
      target: { ariaLabel: 'Bio' },
      value: 'A very long string that goes on and on and on beyond thirty characters',
    }
    const result = humanizeStep(step)
    expect(result).toContain('...')
    expect(result.length).toBeLessThan(80)
  })

  it('describes a navigate step with URL', () => {
    const step: HumanizeStepInput = {
      type: 'navigate',
      url: 'https://mail.google.com/inbox',
    }
    expect(humanizeStep(step)).toBe('Navigated to mail.google.com')
  })

  it('describes a navigate step with invalid URL', () => {
    const step: HumanizeStepInput = {
      type: 'navigate',
      url: 'not-a-url',
    }
    expect(humanizeStep(step)).toBe('Navigated to not-a-url')
  })

  it('describes a wait step with target', () => {
    const step: HumanizeStepInput = {
      type: 'wait',
      target: { ariaLabel: 'Results table' },
    }
    expect(humanizeStep(step)).toBe('Waiting for "Results table" to appear...')
  })

  it('describes a wait step without target', () => {
    const step: HumanizeStepInput = {
      type: 'wait',
      target: {},
    }
    expect(humanizeStep(step)).toBe('Waiting for the page to load...')
  })

  it('describes an extract step', () => {
    const step: HumanizeStepInput = {
      type: 'extract',
      target: { ariaLabel: 'Price list' },
      as: 'prices',
    }
    expect(humanizeStep(step)).toBe('Extracted data from "Price list"')
  })

  it('describes a scroll step', () => {
    const step: HumanizeStepInput = {
      type: 'scroll',
      target: { text: 'Footer' },
    }
    expect(humanizeStep(step)).toBe('Scrolled to "Footer"')
  })

  it('describes a select step', () => {
    const step: HumanizeStepInput = {
      type: 'select',
      target: { ariaLabel: 'Country' },
      value: 'Canada',
    }
    expect(humanizeStep(step)).toBe('Selected "Canada" in "Country"')
  })

  it('describes a hover step', () => {
    const step: HumanizeStepInput = {
      type: 'hover',
      target: { ariaLabel: 'Menu' },
    }
    expect(humanizeStep(step)).toBe('Hovered over "Menu"')
  })

  it('describes a checkpoint step', () => {
    const step: HumanizeStepInput = {
      type: 'checkpoint',
    }
    expect(humanizeStep(step)).toBe('Paused for your confirmation')
  })

  it('prefers explicit description when provided', () => {
    const step: HumanizeStepInput = {
      type: 'click',
      target: { css: '#x' },
      description: 'Click the submit button to confirm order',
    }
    expect(humanizeStep(step)).toBe('Click the submit button to confirm order')
  })

  it('handles unknown step type gracefully', () => {
    const step: HumanizeStepInput = { type: 'custom-action' }
    expect(humanizeStep(step)).toBe('Performed action: custom-action')
  })

  it('handles testId target', () => {
    const step: HumanizeStepInput = {
      type: 'click',
      target: { testId: 'login-button' },
    }
    expect(humanizeStep(step)).toBe('Clicked the login button')
  })
})

describe('humanizeError', () => {
  it('converts SelectorNotFoundError with selector context', () => {
    const result = humanizeError('SelectorNotFoundError: step 4', {
      selector: '[aria-label="Login"]',
    })
    expect(result).toBe("Couldn't find the Login — the page may have changed")
  })

  it('converts element not found without selector', () => {
    const result = humanizeError('Element not found for selector #foo')
    expect(result).toBe("Couldn't find the element on the page — the page may have changed")
  })

  it('converts timeout errors', () => {
    const result = humanizeError('TimeoutError: 5000ms')
    expect(result).toBe('This step took too long to complete')
  })

  it('converts navigate timeout', () => {
    const result = humanizeError('TimeoutError: 5000ms', { stepType: 'navigate' })
    expect(result).toBe('This page took too long to load')
  })

  it('converts wait timeout', () => {
    const result = humanizeError('Timed out waiting for selector', { stepType: 'wait' })
    expect(result).toBe('Waited too long for the page to be ready')
  })

  it('converts network errors', () => {
    const result = humanizeError('net::ERR_CONNECTION_REFUSED')
    expect(result).toBe("Couldn't reach the website — check your internet connection")
  })

  it('converts permission errors', () => {
    const result = humanizeError('403 Forbidden')
    expect(result).toBe("The website didn't allow access — you may need to log in first")
  })

  it('returns generic message for unknown errors', () => {
    const result = humanizeError('some weird internal thing')
    expect(result).toBe('Something unexpected happened')
  })

  it('returns generic message for empty error', () => {
    const result = humanizeError('')
    expect(result).toBe('Something unexpected happened')
  })

  it('converts selector not found with testId selector', () => {
    const result = humanizeError('Cannot find element', {
      selector: '[data-testid="submit-form"]',
    })
    expect(result).toBe("Couldn't find the submit form — the page may have changed")
  })

  it('converts selector not found with ID selector', () => {
    const result = humanizeError('SelectorNotFoundError', {
      selector: '#login-btn',
    })
    expect(result).toBe("Couldn't find the login btn — the page may have changed")
  })
})
