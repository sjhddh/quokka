import type { WatchTrace } from './types.js'

export interface InferredSlot {
  key: string
  label: string
  indices: number[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}[-/]\d{2}[-/]\d{2}$|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/
const NAME_RE = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)+$/

/**
 * Detect values in type entries that look like variable data
 * (emails, dates, names) and suggest them as slots.
 */
export function inferSlots(trace: WatchTrace): InferredSlot[] {
  const slots: InferredSlot[] = []

  for (let i = 0; i < trace.length; i++) {
    const entry = trace[i]
    if (entry.action !== 'type' || !entry.value) continue

    const value = entry.value.trim()
    if (value.length === 0) continue

    if (EMAIL_RE.test(value) || value.includes('@')) {
      const existing = slots.find((s) => s.key === 'email')
      if (existing) {
        existing.indices.push(i)
      } else {
        slots.push({ key: 'email', label: 'Email Address', indices: [i] })
      }
    } else if (DATE_RE.test(value)) {
      const existing = slots.find((s) => s.key === 'date')
      if (existing) {
        existing.indices.push(i)
      } else {
        slots.push({ key: 'date', label: 'Date', indices: [i] })
      }
    } else if (NAME_RE.test(value)) {
      const existing = slots.find((s) => s.key === 'name')
      if (existing) {
        existing.indices.push(i)
      } else {
        slots.push({ key: 'name', label: 'Full Name', indices: [i] })
      }
    }
  }

  return slots
}
