import { humanizeError } from '../../lib/messaging'

/**
 * Visual feedback overlay for failed steps.
 * Shows a red dashed outline on the expected element location
 * and action buttons with plain-English labels near the failed element.
 */
export class FailureOverlay {
  private container: HTMLDivElement | null = null
  private highlight: HTMLDivElement | null = null

  show(
    selector: string,
    error: string,
    onAction: (action: 'retry' | 'skip' | 'fix') => void,
    context?: { stepType?: string },
  ): void {
    this.hide()

    const friendlyError = humanizeError(error, {
      stepType: context?.stepType,
      selector,
    })

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
      ? Math.min(targetEl.getBoundingClientRect().bottom + 8, window.innerHeight - 180)
      : Math.max(window.innerHeight / 2 - 90, 16)
    const panelLeft = targetEl
      ? Math.max(targetEl.getBoundingClientRect().left, 16)
      : Math.max(window.innerWidth / 2 - 160, 16)

    Object.assign(this.container.style, {
      top: `${panelTop}px`,
      left: `${panelLeft}px`,
      maxWidth: '360px',
    })

    // Build the panel
    const panel = document.createElement('div')
    Object.assign(panel.style, {
      background: '#1f2937',
      color: '#f9fafb',
      borderRadius: '8px',
      padding: '14px 18px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      border: '1px solid #374151',
    })

    const title = document.createElement('div')
    title.textContent = 'Something went wrong'
    Object.assign(title.style, {
      fontWeight: '600',
      marginBottom: '6px',
      color: '#fca5a5',
      fontSize: '14px',
    })

    const msg = document.createElement('div')
    msg.textContent = friendlyError
    Object.assign(msg.style, {
      marginBottom: '4px',
      color: '#d1d5db',
      lineHeight: '1.4',
      fontSize: '13px',
    })

    // "Show details" expandable for raw error
    const detailsToggle = document.createElement('button')
    detailsToggle.textContent = 'Show details'
    Object.assign(detailsToggle.style, {
      background: 'none',
      border: 'none',
      color: '#9ca3af',
      fontSize: '11px',
      cursor: 'pointer',
      padding: '0',
      marginBottom: '12px',
      display: 'block',
      textDecoration: 'underline',
    })

    const detailsBox = document.createElement('div')
    detailsBox.textContent = error.length > 200 ? error.slice(0, 197) + '...' : error
    Object.assign(detailsBox.style, {
      display: 'none',
      background: '#111827',
      color: '#9ca3af',
      fontSize: '11px',
      padding: '8px',
      borderRadius: '4px',
      marginBottom: '12px',
      fontFamily: 'monospace',
      lineHeight: '1.3',
      wordBreak: 'break-all',
    })

    detailsToggle.addEventListener('click', () => {
      const isHidden = detailsBox.style.display === 'none'
      detailsBox.style.display = isHidden ? 'block' : 'none'
      detailsToggle.textContent = isHidden ? 'Hide details' : 'Show details'
    })

    // Action buttons with helper text
    const btnColumn = document.createElement('div')
    Object.assign(btnColumn.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    })

    const retryBtn = this.createActionButton(
      'Try again',
      'Quokka will look for the element again',
      '#3b82f6',
      () => { this.hide(); onAction('retry') },
    )

    const skipBtn = this.createActionButton(
      'Skip this step',
      'Continue without this step (results may vary)',
      '#6b7280',
      () => { this.hide(); onAction('skip') },
    )

    const fixBtn = this.createActionButton(
      'Show me what went wrong',
      '',
      'transparent',
      () => { this.hide(); onAction('fix') },
    )
    // Style the fix button as a text link
    const fixBtnEl = fixBtn.querySelector('button')!
    Object.assign(fixBtnEl.style, {
      color: '#93c5fd',
      textDecoration: 'underline',
      padding: '4px 0',
      fontSize: '12px',
    })

    btnColumn.appendChild(retryBtn)
    btnColumn.appendChild(skipBtn)
    btnColumn.appendChild(fixBtn)

    panel.appendChild(title)
    panel.appendChild(msg)
    panel.appendChild(detailsToggle)
    panel.appendChild(detailsBox)
    panel.appendChild(btnColumn)
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

  private createActionButton(
    text: string,
    helperText: string,
    bgColor: string,
    onClick: () => void,
  ): HTMLDivElement {
    const wrapper = document.createElement('div')

    const btn = document.createElement('button')
    btn.textContent = text
    Object.assign(btn.style, {
      background: bgColor,
      color: '#fff',
      border: bgColor === 'transparent' ? 'none' : 'none',
      borderRadius: '6px',
      padding: '6px 16px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      transition: 'opacity 0.15s',
      width: '100%',
      textAlign: 'left',
    })
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85' })
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1' })
    btn.addEventListener('click', onClick)
    wrapper.appendChild(btn)

    if (helperText) {
      const helper = document.createElement('div')
      helper.textContent = helperText
      Object.assign(helper.style, {
        color: '#9ca3af',
        fontSize: '11px',
        marginTop: '2px',
        paddingLeft: '16px',
      })
      wrapper.appendChild(helper)
    }

    return wrapper
  }
}
