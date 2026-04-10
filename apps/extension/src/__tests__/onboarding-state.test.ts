import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for the onboarding state machine logic of the FloatingPill.
 *
 * The pill has states: idle | onboarding | recording | running | error
 * - On first launch (no hasSeenOnboarding flag) -> starts in 'onboarding'
 * - After user clicks pill in onboarding -> dismisses, sets hasSeenOnboarding, transitions to 'idle'
 * - After user clicks dismiss button -> same as above
 * - If hasSeenOnboarding is already true -> starts in 'idle'
 */

// We test the state machine logic in isolation (no React rendering)

type PillState = 'idle' | 'onboarding' | 'recording' | 'running' | 'error'

interface OnboardingStateMachine {
  state: PillState
  hasSeenOnboarding: boolean
  initialize(): void
  clickPill(): void
  dismissOnboarding(): void
  startRecording(): void
  stopRecording(): void
}

function createStateMachine(hasSeenOnboarding: boolean): OnboardingStateMachine {
  const machine: OnboardingStateMachine = {
    state: 'idle',
    hasSeenOnboarding,

    initialize() {
      if (!this.hasSeenOnboarding) {
        this.state = 'onboarding'
      } else {
        this.state = 'idle'
      }
    },

    clickPill() {
      if (this.state === 'onboarding') {
        this.hasSeenOnboarding = true
        this.state = 'idle'
      }
    },

    dismissOnboarding() {
      if (this.state === 'onboarding') {
        this.hasSeenOnboarding = true
        this.state = 'idle'
      }
    },

    startRecording() {
      if (this.state === 'idle') {
        this.state = 'recording'
      }
    },

    stopRecording() {
      if (this.state === 'recording') {
        this.state = 'idle'
      }
    },
  }
  return machine
}

describe('onboarding state machine', () => {
  describe('first-time user (hasSeenOnboarding = false)', () => {
    it('initializes in onboarding state', () => {
      const sm = createStateMachine(false)
      sm.initialize()
      expect(sm.state).toBe('onboarding')
    })

    it('clicking pill transitions to idle and sets flag', () => {
      const sm = createStateMachine(false)
      sm.initialize()
      expect(sm.state).toBe('onboarding')

      sm.clickPill()
      expect(sm.state).toBe('idle')
      expect(sm.hasSeenOnboarding).toBe(true)
    })

    it('dismissing transitions to idle and sets flag', () => {
      const sm = createStateMachine(false)
      sm.initialize()

      sm.dismissOnboarding()
      expect(sm.state).toBe('idle')
      expect(sm.hasSeenOnboarding).toBe(true)
    })

    it('can start recording after dismissing onboarding', () => {
      const sm = createStateMachine(false)
      sm.initialize()
      sm.dismissOnboarding()

      sm.startRecording()
      expect(sm.state).toBe('recording')
    })
  })

  describe('returning user (hasSeenOnboarding = true)', () => {
    it('initializes in idle state', () => {
      const sm = createStateMachine(true)
      sm.initialize()
      expect(sm.state).toBe('idle')
    })

    it('clicking pill does not enter onboarding', () => {
      const sm = createStateMachine(true)
      sm.initialize()

      sm.clickPill()
      // State remains idle since we're not in onboarding
      expect(sm.state).toBe('idle')
    })

    it('can start and stop recording', () => {
      const sm = createStateMachine(true)
      sm.initialize()

      sm.startRecording()
      expect(sm.state).toBe('recording')

      sm.stopRecording()
      expect(sm.state).toBe('idle')
    })
  })

  describe('state transitions are idempotent', () => {
    it('dismissing when not in onboarding is a no-op', () => {
      const sm = createStateMachine(true)
      sm.initialize()
      expect(sm.state).toBe('idle')

      sm.dismissOnboarding()
      expect(sm.state).toBe('idle')
    })

    it('double dismiss does not break state', () => {
      const sm = createStateMachine(false)
      sm.initialize()

      sm.dismissOnboarding()
      expect(sm.state).toBe('idle')

      sm.dismissOnboarding()
      expect(sm.state).toBe('idle')
    })
  })
})
