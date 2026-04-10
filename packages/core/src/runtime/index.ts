export type { BrowserBridge } from './bridge.js'
export { transition } from './state-machine.js'
export { RunEmitter } from './emitter.js'
export { StepExecutor } from './executor.js'
export type { StepResult } from './executor.js'
export { RecipeRunner } from './runner.js'
export type { PauseContext } from './runner.js'
export { checkGuards } from './guard-checker.js'
export type { GuardCheckResult } from './guard-checker.js'
export {
  buildSelectorChain,
  buildNthChildPath,
  buildCombinedSelector,
  buildParentChildSelector,
} from './selector-fallback.js'
export {
  tryWithFallbacks,
  retryWithBackoff,
  buildFailureContext,
  DEFAULT_RETRY_CONFIG,
} from './failure-handler.js'
export type { RetryConfig, FailureContext, PauseAction } from './failure-handler.js'
