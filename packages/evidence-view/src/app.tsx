import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps"
import { RunSnapshot } from "@flowmark/ui/run-snapshot"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { connectEvidenceView, type EvidenceViewState } from "./controller.js"

function EvidenceApp() {
  const [state, setState] = useState<EvidenceViewState>({
    kind: "message",
    message: "Waiting for authorized supplied evidence…",
  })
  const [theme, setTheme] = useState<"light" | "dark">("light")
  useEffect(() => {
    const app = new App(
      { name: "Flowmark run evidence", version: "0.1.0" },
      {},
      { autoResize: false },
    )
    const connection = connectEvidenceView(
      app,
      new PostMessageTransport(window.parent, window.parent),
      setState,
      setTheme,
    )
    const fiber = Effect.runFork(connection.connect)
    return () => {
      connection.dispose()
      Effect.runFork(Fiber.interrupt(fiber))
    }
  }, [])
  return (
    <main
      data-theme={theme}
      className="min-w-0 bg-background p-3 text-foreground"
    >
      <p className="mb-3 text-xs leading-5 text-muted-foreground">
        Supplied Flowmark evidence · not a live view or proof of current access.
      </p>
      {state.kind === "snapshot" ? (
        <RunSnapshot key={JSON.stringify(state.snapshot)} {...state.snapshot} />
      ) : (
        <p role="status" className="text-sm leading-6">
          {state.message}
        </p>
      )}
    </main>
  )
}
createRoot(document.getElementById("root")!).render(<EvidenceApp />)
