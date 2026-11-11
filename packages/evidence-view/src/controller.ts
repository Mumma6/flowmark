import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import type { RunSnapshotProps } from "@flowmark/ui"
import { projectToolEvidence } from "./tool-result.js"

export type EvidenceViewState =
  | { readonly kind: "message"; readonly message: string }
  | {
      readonly kind: "snapshot"
      readonly snapshot: Omit<RunSnapshotProps, "actions">
    }
class ViewConnectionError extends Data.TaggedError("ViewConnectionError")<{
  readonly cause: unknown
}> {}

/** One SDK connection owns its listeners; no fetch, authority or outgoing tool actions. */
export function connectEvidenceView(
  app: App,
  transport: PostMessageTransport,
  render: (state: EvidenceViewState) => void,
  theme: (value: "light" | "dark") => void,
) {
  let active = true
  let argumentsValue: unknown
  let resizeCleanup: (() => void) | undefined
  const message = (text: string) => {
    if (active) {
      render({ kind: "message", message: text })
    }
  }
  const clear = () => {
    argumentsValue = undefined
  }
  const stopResize = () => {
    resizeCleanup?.()
    resizeCleanup = undefined
  }
  const applyTheme = (context: { readonly theme?: string }) => {
    if (active && (context.theme === "light" || context.theme === "dark")) {
      theme(context.theme)
    }
  }
  const connect = Effect.tryPromise({
    try: () => app.connect(transport),
    catch: (cause) => new ViewConnectionError({ cause }),
  }).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        if (active) {
          applyTheme(app.getHostContext() ?? {})
          resizeCleanup = app.setupSizeChangedNotifications()
        }
      }),
    ),
    Effect.catchTag("ViewConnectionError", () =>
      Effect.sync(() =>
        message(
          "The host connection failed. Use its complete structured/text result.",
        ),
      ),
    ),
  )
  app.ontoolinput = ({ arguments: args }) => {
    clear()
    argumentsValue = args
    message("Waiting for the completed evidence result…")
  }
  app.ontoolresult = (result) => {
    if (!active) {
      return
    }
    Result.match(projectToolEvidence(argumentsValue, result), {
      onFailure: (error) => message(error.reason),
      onSuccess: (snapshot) => render({ kind: "snapshot", snapshot }),
    })
  }
  app.ontoolcancelled = () => {
    clear()
    message("The evidence read was cancelled. No evidence is displayed.")
  }
  app.onhostcontextchanged = applyTheme
  app.onerror = () => {
    clear()
    message("Invalid host message. Use the host's structured/text result.")
  }
  app.onclose = () => {
    clear()
    stopResize()
    message("The host connection closed. No evidence is displayed.")
    active = false
  }
  app.onteardown = () => {
    clear()
    stopResize()
    message("The evidence view has closed.")
    active = false
    // Let the SDK send the teardown response before closing its transport.
    setTimeout(() => {
      void transport.close()
    }, 0)
    return {}
  }
  return {
    connect,
    dispose: () => {
      clear()
      stopResize()
      active = false
      void transport.close()
    },
  }
}
