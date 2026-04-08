export interface VerifyResult {
  passed: boolean
  actual: string
  expected: string
  guardType: string
}

export interface VerifyContext {
  url: string
  textContent?: string
  elementExists?: boolean
  elementText?: string
}
