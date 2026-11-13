"use client"
import { Alert, AlertDescription, Badge, Button } from "@flowmark/ui"
import { type BusinessEvidenceQuery } from "@flowmarkdev/core"
import { Array } from "effect"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useBusinessEvidence } from "./use-business-evidence"
import { BusinessData } from "./business-data"
import { ShareQuestion } from "../shared-investigations/share-question"
import { readBusinessLocation } from "./business-location"
export function BusinessWorkspace({
  projectId,
}: {
  readonly projectId: string
}) {
  const router = useRouter(),
    params = useSearchParams(),
    pathname = usePathname()
  const selection = readBusinessLocation(projectId, pathname, params)
  const reads = useBusinessEvidence(projectId, selection)
  const [copyState, setCopyState] = useState<string | null>(null)
  const choose = (next: BusinessEvidenceQuery) => {
    setCopyState(null)
    router.push(
      `/?businessSelection=${encodeURIComponent(JSON.stringify(next))}`,
    )
  }
  const value = reads.evidence.data
  if (!selection) {
    return (
      <Alert>
        <AlertDescription>
          This saved or linked selection is unsupported for business evidence.
          Diagnostic filters are withheld.{" "}
          <Button
            variant="outline"
            onClick={() => choose({ kind: "overview" })}
          >
            Open published evidence
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (reads.capabilities.isError || reads.evidence.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {reads.capabilities.error?.message ?? reads.evidence.error?.message}{" "}
          The publication or your access may have changed.{" "}
          <Button
            variant="outline"
            onClick={() => choose({ kind: "overview" })}
          >
            Restart from published evidence
          </Button>
          <Button variant="outline" onClick={() => void reads.retry()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (!value || reads.capabilities.isPending) {
    return <p role="status">Loading authorized business evidence…</p>
  }
  return (
    <section
      className="mx-auto grid w-full max-w-5xl gap-6"
      aria-label="Business evidence workspace"
    >
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Business evidence</h1>
          <Badge variant="outline">
            Publication {value.projection.publicationRevision}
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Project-wide activity and owner-published values. Raw diagnostics are
          withheld. Customer references are filters, not access restrictions.
          Results describe application reports.
        </p>
        <nav
          className="flex flex-wrap gap-2"
          aria-label="Business investigation"
        >
          <Button
            variant="outline"
            onClick={() => choose({ kind: "overview" })}
          >
            Published meaning
          </Button>
          <Button
            variant="outline"
            onClick={() => choose({ kind: "runs", query: { limit: 25 } })}
          >
            Activity
          </Button>
          <Button
            variant="outline"
            disabled={reads.evidence.isFetching}
            onClick={() => void reads.retry()}
          >
            Refresh evidence
          </Button>
          <Button
            variant="outline"
            disabled={reads.evidence.isFetching}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  JSON.stringify(value, null, 2),
                )
                setCopyState(
                  "Copied this projected observation. It does not prove current access.",
                )
              } catch {
                setCopyState(
                  "Clipboard unavailable. You can still inspect the displayed evidence.",
                )
              }
            }}
          >
            Copy published evidence
          </Button>
        </nav>
        {reads.evidence.isFetching ? (
          <p role="status" className="text-xs text-muted-foreground">
            Refreshing; displayed evidence is the previous observation.
          </p>
        ) : null}
        {copyState ? (
          <p role="status" className="text-xs">
            {copyState}
          </p>
        ) : null}
      </header>
      <ShareQuestion
        key={JSON.stringify(selection)}
        projectId={projectId}
        selection={{ version: 1, depth: "business", query: selection }}
        initialTitle="Published business question"
      />
      <BusinessData
        value={value}
        selection={selection}
        choose={choose}
        projectId={projectId}
      />
      <p className="text-xs text-muted-foreground">
        Observed {new Date(value.projection.observedAt).toLocaleString()}.
        Withheld sections: {Array.join(value.projection.withheld, ", ")}.
      </p>
    </section>
  )
}
