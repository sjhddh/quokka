export interface BrowserBridge {
  click(selector: string): Promise<void>
  type(selector: string, value: string): Promise<void>
  navigate(url: string): Promise<void>
  extract(selector: string): Promise<string>
  waitFor(selector: string, timeout?: number): Promise<void>
  getUrl(): Promise<string>
  getTextContent(selector: string): Promise<string>
}
