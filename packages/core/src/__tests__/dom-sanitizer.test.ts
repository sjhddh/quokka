import { describe, it, expect, beforeEach } from 'vitest'
import { computeStructuralHash, computeStructuralHashAsync } from '../sanitizer/structural-hash.js'
import {
  redactInputValue,
  redactCredentials,
  resetCredentialCounter,
} from '../sanitizer/credential-redactor.js'
import type { AccessNode } from '../sanitizer/dom-sanitizer.js'

// ─── Structural Hash ─────────────────────────────────────────────────────────

describe('computeStructuralHash', () => {
  const baseNodes: AccessNode[] = [
    { role: 'textbox', name: 'Username', selector: '#user', visible: true, interactive: true, tag: 'input' },
    { role: 'textbox', name: 'Password', selector: '#pass', visible: true, interactive: true, tag: 'input' },
    { role: 'button', name: 'Sign In', selector: '#submit', visible: true, interactive: true, tag: 'button' },
  ]

  it('returns a consistent hash for the same input', () => {
    const h1 = computeStructuralHash(baseNodes)
    const h2 = computeStructuralHash(baseNodes)
    expect(h1).toBe(h2)
  })

  it('returns a hex string', () => {
    const hash = computeStructuralHash(baseNodes)
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is not affected by changes to node name (text content)', () => {
    const altNames = baseNodes.map((n) => ({ ...n, name: 'CHANGED-' + n.name }))
    expect(computeStructuralHash(altNames)).toBe(computeStructuralHash(baseNodes))
  })

  it('is not affected by changes to selector', () => {
    const altSelectors = baseNodes.map((n) => ({ ...n, selector: '.different-selector' }))
    expect(computeStructuralHash(altSelectors)).toBe(computeStructuralHash(baseNodes))
  })

  it('is not affected by changes to visibility', () => {
    const hidden = baseNodes.map((n) => ({ ...n, visible: false }))
    expect(computeStructuralHash(hidden)).toBe(computeStructuralHash(baseNodes))
  })

  it('changes when a node role changes', () => {
    const altered = [...baseNodes]
    altered[2] = { ...altered[2], role: 'link' }
    expect(computeStructuralHash(altered)).not.toBe(computeStructuralHash(baseNodes))
  })

  it('changes when a node tag changes', () => {
    const altered = [...baseNodes]
    altered[2] = { ...altered[2], tag: 'a' }
    expect(computeStructuralHash(altered)).not.toBe(computeStructuralHash(baseNodes))
  })

  it('changes when interactive flag changes', () => {
    const altered = baseNodes.map((n) => ({ ...n, interactive: false }))
    expect(computeStructuralHash(altered)).not.toBe(computeStructuralHash(baseNodes))
  })

  it('changes when a node is added', () => {
    const extended = [
      ...baseNodes,
      { role: 'combobox', name: 'Country', selector: '#country', visible: true, interactive: true, tag: 'select' },
    ]
    expect(computeStructuralHash(extended)).not.toBe(computeStructuralHash(baseNodes))
  })

  it('changes when node order changes', () => {
    const reversed = [...baseNodes].reverse()
    expect(computeStructuralHash(reversed)).not.toBe(computeStructuralHash(baseNodes))
  })

  it('returns a consistent hash for empty input', () => {
    const h1 = computeStructuralHash([])
    const h2 = computeStructuralHash([])
    expect(h1).toBe(h2)
  })
})

describe('computeStructuralHashAsync', () => {
  const nodes: AccessNode[] = [
    { role: 'button', name: 'OK', selector: '#ok', visible: true, interactive: true, tag: 'button' },
  ]

  it('returns a string', async () => {
    const hash = await computeStructuralHashAsync(nodes)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('returns the same hash for the same input', async () => {
    const h1 = await computeStructuralHashAsync(nodes)
    const h2 = await computeStructuralHashAsync(nodes)
    expect(h1).toBe(h2)
  })
})

// ─── Credential Redactor ─────────────────────────────────────────────────────

describe('redactInputValue', () => {
  beforeEach(() => {
    resetCredentialCounter()
  })

  /** Helper: create a minimal mock HTMLInputElement */
  function makeInput(attrs: {
    type?: string
    value?: string
    name?: string
    id?: string
  }): HTMLInputElement {
    return {
      type: attrs.type ?? 'text',
      value: attrs.value ?? '',
      name: attrs.name ?? '',
      id: attrs.id ?? '',
    } as unknown as HTMLInputElement
  }

  it('redacts password inputs', () => {
    const el = makeInput({ type: 'password', value: 'hunter2' })
    const result = redactInputValue(el)
    expect(result.isRedacted).toBe(true)
    expect(result.value).toMatch(/^\{\{credential_\d+\}\}$/)
  })

  it('redacts hidden inputs with sensitive names', () => {
    const el = makeInput({ type: 'hidden', value: 'abc123', name: 'auth' })
    const result = redactInputValue(el)
    expect(result.isRedacted).toBe(true)
    expect(result.value).toMatch(/^\{\{credential_\d+\}\}$/)
  })

  it('redacts credit card numbers', () => {
    const el = makeInput({ type: 'text', value: '4111 1111 1111 1111' })
    const result = redactInputValue(el)
    expect(result.isRedacted).toBe(true)
  })

  it('redacts credit card numbers with dashes', () => {
    const el = makeInput({ type: 'text', value: '4111-1111-1111-1111' })
    const result = redactInputValue(el)
    expect(result.isRedacted).toBe(true)
  })

  it('redacts SSN patterns', () => {
    const el = makeInput({ type: 'text', value: '123-45-6789' })
    const result = redactInputValue(el)
    expect(result.isRedacted).toBe(true)
  })

  it('redacts API key patterns', () => {
    const el = makeInput({ type: 'text', value: 'sk-abc123xyz456' })
    const result = redactInputValue(el)
    expect(result.isRedacted).toBe(true)
  })

  it('redacts bearer token patterns', () => {
    const el = makeInput({ type: 'text', value: 'Bearer eyJhbGciOiJIUzI1NiJ9' })
    const result = redactInputValue(el)
    expect(result.isRedacted).toBe(true)
  })

  it('does NOT redact normal text input', () => {
    const el = makeInput({ type: 'text', value: 'hello world' })
    const result = redactInputValue(el)
    expect(result.isRedacted).toBe(false)
    expect(result.value).toBe('hello world')
  })

  it('does NOT redact email values (flags but keeps them)', () => {
    const el = makeInput({ type: 'email', value: 'test@example.com' })
    const result = redactInputValue(el)
    expect(result.isRedacted).toBe(false)
    expect(result.value).toBe('test@example.com')
  })

  it('increments credential tokens across calls', () => {
    const pw1 = makeInput({ type: 'password', value: 'a' })
    const pw2 = makeInput({ type: 'password', value: 'b' })
    const r1 = redactInputValue(pw1)
    const r2 = redactInputValue(pw2)
    expect(r1.value).toBe('{{credential_1}}')
    expect(r2.value).toBe('{{credential_2}}')
  })
})

describe('redactCredentials (AccessNode[])', () => {
  beforeEach(() => {
    resetCredentialCounter()
  })

  it('redacts node names containing credit card numbers', () => {
    const nodes: AccessNode[] = [
      { role: 'textbox', name: 'Card: 4111 1111 1111 1111', selector: '#cc', visible: true, interactive: true, tag: 'input' },
    ]
    const { nodes: redacted, variableMap } = redactCredentials(nodes)
    expect(redacted[0].name).not.toContain('4111')
    expect(redacted[0].name).toMatch(/\{\{credential_\d+\}\}/)
    expect(variableMap.size).toBeGreaterThan(0)
  })

  it('redacts node names containing SSN patterns', () => {
    const nodes: AccessNode[] = [
      { role: 'textbox', name: 'SSN: 123-45-6789', selector: '#ssn', visible: true, interactive: true, tag: 'input' },
    ]
    const { nodes: redacted } = redactCredentials(nodes)
    expect(redacted[0].name).not.toContain('123-45-6789')
  })

  it('redacts password-role textbox nodes with sensitive names', () => {
    const nodes: AccessNode[] = [
      { role: 'textbox', name: 'password', selector: '#pw', visible: true, interactive: true, tag: 'input' },
    ]
    const { nodes: redacted, variableMap } = redactCredentials(nodes)
    expect(redacted[0].name).toMatch(/^\{\{credential_\d+\}\}$/)
    expect(variableMap.size).toBe(1)
  })

  it('leaves non-sensitive nodes unchanged', () => {
    const nodes: AccessNode[] = [
      { role: 'button', name: 'Submit', selector: '#btn', visible: true, interactive: true, tag: 'button' },
      { role: 'link', name: 'Home', selector: 'a.home', visible: true, interactive: true, tag: 'a' },
    ]
    const { nodes: redacted, variableMap } = redactCredentials(nodes)
    expect(redacted[0].name).toBe('Submit')
    expect(redacted[1].name).toBe('Home')
    expect(variableMap.size).toBe(0)
  })

  it('returns original node references for unmodified nodes', () => {
    const nodes: AccessNode[] = [
      { role: 'button', name: 'OK', selector: '#ok', visible: true, interactive: true, tag: 'button' },
    ]
    const { nodes: redacted } = redactCredentials(nodes)
    // Same reference since name was not redacted
    expect(redacted[0]).toBe(nodes[0])
  })
})
