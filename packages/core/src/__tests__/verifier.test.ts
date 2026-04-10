import { describe, it, expect } from 'vitest'
import type { Guard } from '@quokka/shared'
import { verify } from '../verifier/verifier.js'

describe('verify', () => {
  describe('url guard', () => {
    const guard: Guard = {
      type: 'url',
      expect: '/dashboard',
      timeout: 5000,
    }

    it('passes when URL contains expected substring', () => {
      const result = verify(guard, { url: 'https://app.com/dashboard/home' })
      expect(result.passed).toBe(true)
      expect(result.guardType).toBe('url')
      expect(result.actual).toBe('https://app.com/dashboard/home')
      expect(result.expected).toBe('/dashboard')
    })

    it('fails when URL does not contain expected substring', () => {
      const result = verify(guard, { url: 'https://app.com/login' })
      expect(result.passed).toBe(false)
    })
  })

  describe('dom guard', () => {
    const guard: Guard = {
      type: 'dom',
      selector: '#success-banner',
      expect: '#success-banner',
      timeout: 5000,
    }

    it('passes when element exists', () => {
      const result = verify(guard, {
        url: 'https://app.com',
        elementExists: true,
      })
      expect(result.passed).toBe(true)
      expect(result.guardType).toBe('dom')
    })

    it('fails when element does not exist', () => {
      const result = verify(guard, {
        url: 'https://app.com',
        elementExists: false,
      })
      expect(result.passed).toBe(false)
    })

    it('fails when elementExists is undefined', () => {
      const result = verify(guard, { url: 'https://app.com' })
      expect(result.passed).toBe(false)
    })
  })

  describe('text guard', () => {
    const guard: Guard = {
      type: 'text',
      expect: 'Welcome back',
      timeout: 5000,
    }

    it('passes when textContent includes expected string', () => {
      const result = verify(guard, {
        url: 'https://app.com',
        textContent: 'Welcome back, John!',
      })
      expect(result.passed).toBe(true)
      expect(result.guardType).toBe('text')
    })

    it('fails when textContent does not include expected string', () => {
      const result = verify(guard, {
        url: 'https://app.com',
        textContent: 'Please log in',
      })
      expect(result.passed).toBe(false)
    })

    it('fails when textContent is undefined', () => {
      const result = verify(guard, { url: 'https://app.com' })
      expect(result.passed).toBe(false)
    })
  })
})
