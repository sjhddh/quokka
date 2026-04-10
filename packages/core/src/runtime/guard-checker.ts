import type { Guard } from '@quokka/shared'
import type { VerifyResult, VerifyContext } from '../verifier/types.js'
import { verify } from '../verifier/verifier.js'
import type { BrowserBridge } from './bridge.js'

export interface GuardCheckResult {
  passed: boolean
  results: VerifyResult[]
}

export async function checkGuards(
  guards: Guard[],
  bridge: BrowserBridge,
): Promise<GuardCheckResult> {
  if (guards.length === 0) {
    return { passed: true, results: [] }
  }

  const results: VerifyResult[] = []
  let allPassed = true

  for (const guard of guards) {
    const url = await bridge.getUrl()
    const context: VerifyContext = { url }

    if (guard.type === 'dom' && guard.selector) {
      try {
        const text = await bridge.getTextContent(guard.selector)
        context.elementExists = text !== ''
      } catch {
        context.elementExists = false
      }
    }

    if (guard.type === 'text' && guard.selector) {
      try {
        context.textContent = await bridge.getTextContent(guard.selector)
      } catch {
        context.textContent = ''
      }
    }

    const result = verify(guard, context)
    results.push(result)

    if (!result.passed) {
      allPassed = false
    }
  }

  return { passed: allPassed, results }
}
