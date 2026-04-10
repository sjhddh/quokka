export type { AccessNode, PageSnapshot } from './dom-sanitizer.js'
export { capturePageSnapshot } from './dom-sanitizer.js'

export type { RedactionResult, InputRedactionResult } from './credential-redactor.js'
export { redactCredentials, redactInputValue, resetCredentialCounter } from './credential-redactor.js'

export { computeStructuralHash, computeStructuralHashAsync } from './structural-hash.js'
