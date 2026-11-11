import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps"
import { Button } from "@flowmark/ui/button"
import { RunSnapshot } from "@flowmark/ui/run-snapshot"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import { useEffect, useState } from "react"
import type { EvidenceAction } from "./lifecycle.js"
import { createRoot } from "react-dom/client"
import { runEvidenceView, type EvidenceViewState } from "./controller.js"

function EvidenceApp() {
  const [state, setState] = useState<EvidenceViewState>({
    kind: "message",
    status: "waiting",
    message: "Waiting for authorized supplied evidence…",
  })
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [navigate, setNavigate] = useState<
    ((action: EvidenceAction) => void) | null
  >(null)
  useEffect(() => {
    const app = new App(
      { name: "Flowmark run evidence", version: "0.1.0" },
      {},
      { autoResize: false },
    )
    const connection = runEvidenceView(
      app,
      new PostMessageTransport(window.parent, window.parent),
      setState,
      setTheme,
      (action) => setNavigate(() => action),
    )
    const fiber = Effect.runFork(connection)
    return () => {
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
        <section aria-label="Run evidence" aria-busy={state.busy}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!state.canRead || state.busy || !navigate}
              onClick={() => navigate?.("refresh")}
            >
              Refresh this page
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={
                !state.canRead ||
                state.busy ||
                !navigate ||
                state.evidence.nextCursor === null
              }
              onClick={() => navigate?.("next")}
            >
              Next events page
            </Button>
          </div>
          <p
            role="status"
            className="mb-3 text-xs leading-5 text-muted-foreground"
          >
            {state.busy
              ? "Reading through the host… Displayed evidence is from the previous read."
              : state.canRead
                ? "Reads stay in this project and run. Refresh rereads the displayed page; next page replaces it."
                : "This host supplies evidence only. Use its complete structured/text result for further reads."}
          </p>
          <RunSnapshot
            key={JSON.stringify(state.evidence.snapshot)}
            {...state.evidence.snapshot}
          />
        </section>
      ) : (
        <p role="status" className="text-sm leading-6">
          {state.message}
        </p>
      )}
    </main>
  )
}
createRoot(document.getElementById("root")!).render(<EvidenceApp />)
