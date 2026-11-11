import { observePromise } from "./observe-promise"

export type ClipboardFeedback = "idle" | "copied" | "failed"

/** Browser callbacks and timers belong to this disposable interaction, never module state. */
export const clipboardFeedback = (
  write: (value: string) => Promise<void>,
  update: (state: ClipboardFeedback) => void,
  clock = {
    set: (f: () => void) => globalThis.setTimeout(f, 2000),
    clear: (timer: ReturnType<typeof setTimeout>) =>
      globalThis.clearTimeout(timer),
  },
) => {
  let active = true
  let cancel: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => {
    cancel?.()
    if (timer !== undefined) {
      clock.clear(timer)
    }
  }
  return {
    copy: (value: string) => {
      if (!active) {
        return
      }
      clear()
      update("idle")
      cancel = observePromise(
        () => write(value),
        () => {
          update("copied")
          timer = clock.set(() => update("idle"))
        },
        () => update("failed"),
      )
    },
    dispose: () => {
      active = false
      clear()
    },
  }
}
