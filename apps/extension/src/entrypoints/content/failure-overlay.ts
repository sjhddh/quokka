/**
 * Visual feedback overlay for failed steps.
 * Shows a red dashed outline on the expected element location
 * and Retry/Skip buttons near the failed element.
 */
export class FailureOverlay {
  private container: HTMLDivElement | null = null
  private highlight: HTMLDivElement | null = null

  show(
    selector: string,
    error: string,
    onAction: (action: 'retry' | 'skip') => void,
  ): void {
    this.hide()

    // Try to find and highlight the target element
    const targetEl = selector ? document.querySelector<HTMLElement>(selector) : null

    // Create overlay container
    this.container = document.createElement('div')
    this.container.id = 'quokka-failure-overlay'
    Object.assign(this.container.style, {
      position: 'fixed',
      zIndex: '2147483647',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
    })

    // If we found the element, highlight it with a red dashed outline
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect()
      this.highlight = document.createElement('div')
      this.highlight.id = 'quokka-failure-highlight'
      Object.assign(this.highlight.style, {
        position: 'fixed',
        top: `${rect.top - 3}px`,
        left: `${rect.left - 3}px`,
        width: `${rect.width + 6}px`,
        height: `${rect.height + 6}px`,
        border: '2px dashed #ef4444',
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: '2147483646',
        boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.15)',
      })
      document.body.appendChild(this.highlight)
    }

    // Position the action panel near the element or center of screen
    const panelTop = targetEl
      ? Math.min(targetEl.getBoundingClientRect().bottom + 8, window.innerHeight - 120)
      : Math.max(window.innerHeight / 2 - 60, 16)
    const panelLeft = targetEl
      ? Math.max(targetEl.getBoundingClientRect().left, 16)
      : Math.max(window.innerWidth / 2 - 140, 16)

    Object.assign(this.container.style, {
      top: `${panelTop}px`,
      left: `${panelLeft}px`,
      maxWidth: '320px',
    })

    // Build the panel
    const panel = document.createElement('div')
    Object.assign(panel.style, {
      background: '#1f2937',
      color: '#f9fafb',
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      border: '1px solid #374151',
    })

    const title = document.createElement('div')
    title.textContent = 'Step Failed'
    Object.assign(title.style, {
      fontWeight: '600',
      marginBottom: '6px',
      color: '#fca5a5',
      fontSize: '14px',
    })

    const msg = document.createElement('div')
    msg.textContent = error.length > 120 ? error.slice(0, 117) + '...' : error
    Object.assign(msg.style, {
      marginBottom: '12px',
      color: '#d1d5db',
      lineHeight: '1.4',
      fontSize: '12px',
    })

    const btnRow = document.createElement('div')
    Object.assign(btnRow.style, {
      display: 'flex',
      gap: '8px',
    })

    const retryBtn = this.createButton('Retry', '#3b82f6', () => {
      this.hide()
      onAction('retry')
    })

    const skipBtn = this.createButton('Skip', '#6b7280', () => {
      this.hide()
      onAction('skip')
    })

    btnRow.appendChild(retryBtn)
    btnRow.appendChild(skipBtn)
    panel.appendChild(title)
    panel.appendChild(msg)
    panel.appendChild(btnRow)
    this.container.appendChild(panel)
    document.body.appendChild(this.container)
  }

  hide(): void {
    if (this.container) {
      this.container.remove()
      this.container = null
    }
    if (this.highlight) {
      this.highlight.remove()
      this.highlight = null
    }
  }

  private createButton(
    text: string,
    bgColor: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.textContent = text
    Object.assign(btn.style, {
      background: bgColor,
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      padding: '6px 16px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      transition: 'opacity 0.15s',
    })
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85' })
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1' })
    btn.addEventListener('click', onClick)
    return btn
  }
}
