/**
 * Credential redaction for DOM snapshots and input recording.
 * Prevents sensitive values from reaching LLM providers.
 */

import type { AccessNode } from './dom-sanitizer.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RedactionResult {
  redactedValue: string
  /** Maps token (e.g. "{{credential_1}}") → original value. Keep local only — never send to LLM. */
  variableMap: Map<string, string>
}

export interface InputRedactionResult {
  value: string
  isRedacted: boolean
}

// ─── Sensitive field name patterns ────────────────────────────────────────────

const SENSITIVE_FIELD_NAMES = /(?:^|[\s_\-./])(?:token|csrf|secret|key|auth|apikey|api_key|password|passwd|credential|private)(?:$|[\s_\-./])/i

// ─── Value patterns ───────────────────────────────────────────────────────────

const CREDIT_CARD_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/
const API_KEY_RE = /\b(?:sk-|pk_|api[_-]?key[=:\s]|bearer\s+)\S+/i
const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/

// ─── Token counter (module-level, resets per redactor instance) ───────────────

let _counter = 0

function nextToken(): string {
  _counter += 1
  return `{{credential_${_counter}}}`
}

/** Reset the counter — call between test runs or recording sessions. */
export function resetCredentialCounter(): void {
  _counter = 0
}

// ─── Core redaction logic ─────────────────────────────────────────────────────

/**
 * Determine whether an input element should have its value redacted,
 * and return the (possibly redacted) value.
 *
 * Called synchronously during recording — no side effects beyond returning result.
 */
export function redactInputValue(element: HTMLInputElement): InputRedactionResult {
  const value = element.value

  // Rule 1: password inputs — always redact
  if (element.type?.toLowerCase() === 'password') {
    return { value: nextToken(), isRedacted: true }
  }

  // Rule 2: hidden inputs with sensitive names
  if (element.type?.toLowerCase() === 'hidden') {
    const name = (element.name || element.id || '').toLowerCase()
    if (SENSITIVE_FIELD_NAMES.test(name)) {
      return { value: nextToken(), isRedacted: true }
    }
  }

  // Rule 3: value matches sensitive patterns
  if (CREDIT_CARD_RE.test(value) || SSN_RE.test(value) || API_KEY_RE.test(value)) {
    return { value: nextToken(), isRedacted: true }
  }

  // Rule 4: email in input — flag but do not redact
  if (EMAIL_RE.test(value)) {
    return { value, isRedacted: false }
  }

  return { value, isRedacted: false }
}

/**
 * Walk a DOM snapshot and redact any credential-like values from node names.
 * Returns a new array of AccessNodes with sensitive data replaced by tokens.
 *
 * The variableMap in the return value maps tokens → original values.
 * Callers must keep this map local and never forward it to an LLM.
 */
export function redactCredentials(
  nodes: AccessNode[],
): { nodes: AccessNode[]; variableMap: Map<string, string> } {
  const variableMap = new Map<string, string>()

  function redactText(text: string): string {
    let result = text

    // Redact credit card numbers
    result = result.replace(CREDIT_CARD_RE, () => {
      const token = nextToken()
      variableMap.set(token, text)
      return token
    })

    // Redact SSNs
    result = result.replace(SSN_RE, () => {
      const token = nextToken()
      variableMap.set(token, text)
      return token
    })

    // Redact API keys / bearer tokens
    result = result.replace(API_KEY_RE, () => {
      const token = nextToken()
      variableMap.set(token, text)
      return token
    })

    return result
  }

  const redacted = nodes.map((node): AccessNode => {
    // password-role or sensitive input names → redact entire name
    const isPasswordNode =
      node.role === 'textbox' &&
      (node.tag === 'input') &&
      SENSITIVE_FIELD_NAMES.test(node.name)

    if (isPasswordNode) {
      const token = nextToken()
      variableMap.set(token, node.name)
      return { ...node, name: token }
    }

    const redactedName = redactText(node.name)
    return redactedName !== node.name ? { ...node, name: redactedName } : node
  })

  return { nodes: redacted, variableMap }
}
