import type { Guard } from '@quokka/shared'
import type { VerifyResult, VerifyContext } from './types.js'

/**
 * Verify a guard condition against a runtime context.
 */
export function verify(guard: Guard, context: VerifyContext): VerifyResult {
  switch (guard.type) {
    case 'url': {
      const passed = context.url.includes(guard.expect)
      return {
        passed,
        actual: context.url,
        expected: guard.expect,
        guardType: 'url',
      }
    }

    case 'dom': {
      const passed = context.elementExists === true
      return {
        passed,
        actual: String(context.elementExists ?? false),
        expected: 'true',
        guardType: 'dom',
      }
    }

    case 'text': {
      const content = context.textContent ?? ''
      const passed = content.includes(guard.expect)
      return {
        passed,
        actual: content,
        expected: guard.expect,
        guardType: 'text',
      }
    }
  }
}
