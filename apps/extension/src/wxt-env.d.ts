// Ambient type declarations for WXT framework globals
// WXT injects these at build time; this file satisfies tsc --noEmit

declare function defineBackground(fn: () => void): void
declare function defineBackground(options: { persistent?: boolean; main: () => void }): void

declare function defineContentScript(options: {
  matches: string[]
  runAt?: 'document_start' | 'document_end' | 'document_idle'
  main: () => void
}): void

// CSS inline imports (Vite/WXT)
declare module '*.css?inline' {
  const css: string
  export default css
}
