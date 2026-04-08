export class ContentBridge {
  async click(selector: string): Promise<void> {
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) throw new Error(`Element not found: ${selector}`)
    el.click()
  }

  async type(selector: string, value: string): Promise<void> {
    const el = document.querySelector<HTMLInputElement>(selector)
    if (!el) throw new Error(`Element not found: ${selector}`)

    el.focus()
    el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  async navigate(url: string): Promise<void> {
    window.location.href = url
  }

  async extract(selector: string): Promise<string> {
    const el = document.querySelector(selector)
    if (!el) throw new Error(`Element not found: ${selector}`)
    return el.textContent ?? ''
  }

  async waitFor(selector: string, timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      // Already exists
      if (document.querySelector(selector)) {
        resolve()
        return
      }

      const interval = 200
      let elapsed = 0
      const timer = setInterval(() => {
        elapsed += interval
        if (document.querySelector(selector)) {
          clearInterval(timer)
          resolve()
        } else if (elapsed >= timeout) {
          clearInterval(timer)
          reject(new Error(`Timed out waiting for: ${selector}`))
        }
      }, interval)
    })
  }
}
