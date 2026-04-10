import { useState, useEffect, useCallback } from 'react'

export interface ToastItem {
  id: number
  text: string
}

let toastId = 0

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((text: string) => {
    const id = ++toastId
    setToasts((prev) => [...prev.slice(-4), { id, text }])
    // Remove after animation completes (2s)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2000)
  }, [])

  return { toasts, addToast }
}

export default function StepToast({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  )
}
