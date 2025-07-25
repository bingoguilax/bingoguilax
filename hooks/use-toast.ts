"use client"

import { useState, useCallback } from "react"

type ToastVariant = "default" | "destructive"

interface Toast {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

let toastCount = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(
    ({
      title,
      description,
      variant = "default",
    }: {
      title: string
      description?: string
      variant?: ToastVariant
    }) => {
      const id = (++toastCount).toString()
      const newToast = { id, title, description, variant }

      setToasts((prev) => [...prev, newToast])

      // Auto dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 5000)

      return id
    },
    [],
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toast, dismiss, toasts }
}
