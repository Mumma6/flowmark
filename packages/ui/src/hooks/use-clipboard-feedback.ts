"use client"

import { useEffect, useRef, useState } from "react"
import {
  clipboardFeedback,
  type ClipboardFeedback,
} from "../lifecycle/clipboard-feedback"

export const useClipboardFeedback = () => {
  const [state, setState] = useState<ClipboardFeedback>("idle")
  const interaction = useRef<ReturnType<typeof clipboardFeedback> | null>(null)
  useEffect(() => {
    const owner = clipboardFeedback(
      (value) => navigator.clipboard.writeText(value),
      setState,
    )
    interaction.current = owner
    return () => {
      owner.dispose()
      interaction.current = null
    }
  }, [])
  return {
    copied: state === "copied",
    copyFailed: state === "failed",
    copy: (value: string) => interaction.current?.copy(value),
  }
}
