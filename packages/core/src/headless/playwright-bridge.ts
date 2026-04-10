import type { BrowserBridge } from '../runtime/bridge.js'
import type { Page } from 'playwright'

export class PlaywrightBridge implements BrowserBridge {
  constructor(private page: Page) {}

  async click(selector: string): Promise<void> {
    await this.page.click(selector)
  }

  async type(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value)
  }

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' })
  }

  async extract(selector: string): Promise<string> {
    const texts = await this.page.$$eval(selector, (els) =>
      els.map((el) => el.textContent || ''),
    )
    return texts.join('\n')
  }

  async waitFor(selector: string, timeout?: number): Promise<void> {
    await this.page.waitForSelector(selector, { timeout })
  }

  async getUrl(): Promise<string> {
    return this.page.url()
  }

  async getTextContent(selector: string): Promise<string> {
    return (await this.page.textContent(selector)) ?? ''
  }
}
