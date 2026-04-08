export interface TraceEntry {
  action: "click" | "type" | "navigate" | "scroll"
  selector: string
  value?: string
  url: string
  timestamp: number
  tagName?: string
  textContent?: string
}

export type WatchTrace = TraceEntry[]
