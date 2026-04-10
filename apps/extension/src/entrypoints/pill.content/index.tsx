import { createRoot } from 'react-dom/client'
import FloatingPill from './FloatingPill'
import pillCss from './pill.css?inline'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    // Don't inject into extension pages
    if (
      window.location.protocol === 'chrome-extension:' ||
      window.location.protocol === 'chrome:'
    ) {
      return
    }

    // Create custom element with Shadow DOM for style isolation
    const host = document.createElement('quokka-pill')
    // Reset any inherited styles
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;'
    document.documentElement.appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })

    // Inject scoped styles
    const style = document.createElement('style')
    style.textContent = pillCss
    shadow.appendChild(style)

    // Mount React into shadow DOM
    const mountPoint = document.createElement('div')
    mountPoint.id = 'quokka-pill-root'
    shadow.appendChild(mountPoint)

    const root = createRoot(mountPoint)
    root.render(<FloatingPill />)
  },
})
