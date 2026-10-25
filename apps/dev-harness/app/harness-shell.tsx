import Link from "next/link"
import { Badge, Button, FlowmarkMark } from "@flowmark/ui"
import type { ReactNode } from "react"

export function HarnessShell({
  children,
  diagnostics = false,
}: {
  children: ReactNode
  diagnostics?: boolean
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-semibold tracking-tight"
          >
            <FlowmarkMark className="shrink-0 text-primary" />
            <span>
              flowmark<span className="text-primary">.</span>
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="flex flex-wrap items-center gap-2"
          >
            <Button
              asChild
              variant={diagnostics ? "ghost" : "secondary"}
              size="sm"
            >
              <Link href="/" aria-current={diagnostics ? undefined : "page"}>
                Operations
              </Link>
            </Button>
            <Button
              asChild
              variant={diagnostics ? "secondary" : "ghost"}
              size="sm"
            >
              <Link
                href="/diagnostics"
                aria-current={diagnostics ? "page" : undefined}
              >
                SDK diagnostics
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="http://localhost:3001">Open dashboard ↗</a>
            </Button>
          </nav>
        </div>
      </header>
      <div className="border-b border-border bg-secondary/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-3 text-xs leading-5 text-muted-foreground sm:px-8">
          <Badge variant="outline">Local development only</Badge>
          Synthetic records. Simulated suppliers, storage and carrier. Nothing
          is charged or shipped.
        </div>
      </div>
      <main className="mx-auto grid min-w-0 max-w-7xl gap-6 px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
      <footer className="mx-auto max-w-7xl px-5 pb-8 text-xs leading-6 text-muted-foreground sm:px-8">
        Application data is simulated per execution. Telemetry is persisted in
        your local Flowmark database. Never deploy or expose this app.
      </footer>
    </div>
  )
}
