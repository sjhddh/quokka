import { MessageType } from '../../lib/messaging'

const QUOKKA_LINK_ATTR = 'data-quokka-import-btn'
const BUTTON_CLASS = 'quokka-import-btn'

/**
 * Content script module that detects .quokka.json links on the page
 * and injects "Import to Quokka" buttons next to them.
 */
export class LinkDetector {
  private observer: MutationObserver | null = null

  start(): void {
    this.scanLinks(document.body)
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            this.scanLinks(node)
          }
        }
      }
    })
    this.observer.observe(document.body, { childList: true, subtree: true })
  }

  stop(): void {
    this.observer?.disconnect()
    this.observer = null
    // Remove all injected buttons
    document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((el) => el.remove())
  }

  private scanLinks(root: HTMLElement): void {
    const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href]')
    for (const anchor of anchors) {
      this.maybeInjectButton(anchor)
    }
    // Also check if root itself is an anchor
    if (root instanceof HTMLAnchorElement) {
      this.maybeInjectButton(root)
    }
  }

  private maybeInjectButton(anchor: HTMLAnchorElement): void {
    // Skip if already processed
    if (anchor.getAttribute(QUOKKA_LINK_ATTR)) return

    const href = anchor.href
    if (!href) return

    // Check if the link points to a .quokka.json file
    if (!isQuokkaLink(href)) return

    anchor.setAttribute(QUOKKA_LINK_ATTR, 'true')
    const btn = this.createImportButton(href)
    anchor.parentElement?.insertBefore(btn, anchor.nextSibling)
  }

  private createImportButton(url: string): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = BUTTON_CLASS
    btn.textContent = '\u{1F43F}\uFE0F Import'
    btn.title = 'Import this recipe to Quokka'

    // Inline styles to be unobtrusive and not depend on page CSS
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      marginLeft: '6px',
      padding: '2px 8px',
      fontSize: '12px',
      fontWeight: '500',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#4f46e5',
      backgroundColor: '#eef2ff',
      border: '1px solid #c7d2fe',
      borderRadius: '4px',
      cursor: 'pointer',
      verticalAlign: 'middle',
      lineHeight: '1.4',
    })

    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = '#e0e7ff'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = '#eef2ff'
    })

    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      btn.textContent = 'Importing...'
      btn.disabled = true

      chrome.runtime.sendMessage({
        type: MessageType.IMPORT_FROM_URL,
        payload: { url },
      }).then((response) => {
        if (response?.ok) {
          btn.textContent = 'Imported!'
          btn.style.color = '#059669'
          btn.style.borderColor = '#a7f3d0'
          btn.style.backgroundColor = '#ecfdf5'
        } else {
          btn.textContent = 'Failed'
          btn.style.color = '#dc2626'
          btn.style.borderColor = '#fca5a5'
          btn.style.backgroundColor = '#fef2f2'
        }
        setTimeout(() => {
          btn.textContent = '\u{1F43F}\uFE0F Import'
          btn.disabled = false
          btn.style.color = '#4f46e5'
          btn.style.borderColor = '#c7d2fe'
          btn.style.backgroundColor = '#eef2ff'
        }, 2000)
      }).catch(() => {
        btn.textContent = '\u{1F43F}\uFE0F Import'
        btn.disabled = false
      })
    })

    return btn
  }
}

/**
 * Check if a URL looks like a .quokka.json file link.
 */
export function isQuokkaLink(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.pathname.endsWith('.quokka.json')
  } catch {
    return false
  }
}
