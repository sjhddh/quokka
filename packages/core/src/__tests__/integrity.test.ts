import { describe, it, expect } from 'vitest'
import { computeIntegrity, verifyIntegrity } from '../verifier/integrity.js'
import type { Recipe } from '@quokka/shared'

const recipe: Recipe = {
  id: 'integrity-test',
  name: 'Integrity Test',
  version: '0.1.0',
  schemaVersion: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  hosts: ['example.com'],
  slots: [],
  guards: [],
  steps: [
    { type: 'navigate', url: 'https://example.com' },
    { type: 'click', target: { css: '#btn' } },
  ],
  meta: { createdFrom: 'code', tags: [] },
}

describe('integrity', () => {
  describe('computeIntegrity', () => {
    it('returns a hex SHA-256 hash', () => {
      const hash = computeIntegrity(recipe)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('is deterministic', () => {
      const hash1 = computeIntegrity(recipe)
      const hash2 = computeIntegrity(recipe)
      expect(hash1).toBe(hash2)
    })

    it('changes when recipe content changes', () => {
      const modified = { ...recipe, name: 'Modified' }
      expect(computeIntegrity(recipe)).not.toBe(computeIntegrity(modified))
    })

    it('ignores the integrity field itself', () => {
      const withIntegrity = { ...recipe, integrity: 'old-hash' }
      const withoutIntegrity = { ...recipe }
      expect(computeIntegrity(withIntegrity)).toBe(computeIntegrity(withoutIntegrity))
    })
  })

  describe('verifyIntegrity', () => {
    it('returns true when no integrity field is present', () => {
      expect(verifyIntegrity(recipe)).toBe(true)
    })

    it('returns true when integrity matches', () => {
      const hash = computeIntegrity(recipe)
      const signed = { ...recipe, integrity: hash }
      expect(verifyIntegrity(signed)).toBe(true)
    })

    it('returns false when integrity does not match (tampered)', () => {
      const tampered = { ...recipe, integrity: 'deadbeef'.repeat(8), name: 'Tampered' }
      expect(verifyIntegrity(tampered)).toBe(false)
    })
  })
})
