"use client"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import Link from "next/link"
import type {
  LinkedComparisonSelection,
  LinkedEvidencePage,
} from "@flowmarkdev/core"
import { runInvestigationPath } from "../../runs/investigation/investigation-navigation"
import { formatTimestamp } from "../../shared/format"
import { linkedComparisonLocation } from "./linked-selection"
import { linkedCoverageLabels } from "./linked-presentation"

export function LinkedEvidence({
  page,
  selection,
  navigate,
}: {
  page: LinkedEvidencePage
  selection: LinkedComparisonSelection
  navigate: (next: LinkedComparisonSelection) => void
}) {
  const from = linkedComparisonLocation(selection)
  const nextCursor = page.nextCursor
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contributing execution evidence</CardTitle>
        <CardDescription>
          {page.query.scope} window ·{" "}
          {page.query.coverage
            ? linkedCoverageLabels[page.query.coverage]
            : "All retained upstream attempts"}{" "}
          · {page.total} matching attempts. This is a fresh read of the selected
          population; evidence can change after the aggregate.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        {page.rows.length === 0 && (
          <p className="text-sm">
            No evidence matches this selection. This does not establish that no
            application work occurred.
          </p>
        )}
        <ol className="grid min-w-0 gap-3">
          {page.rows.map((row) => (
            <li
              key={row.anchor.id}
              className="grid min-w-0 gap-3 rounded-lg border border-border p-4 text-sm"
            >
              <p className="font-medium">
                {linkedCoverageLabels[row.coverage]}
              </p>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Upstream attempt · {formatTimestamp(row.anchor.startedAt)}{" "}
                    UTC
                  </p>
                  <Link
                    className="block min-h-9 break-all text-primary underline-offset-4 hover:underline"
                    href={runInvestigationPath(row.anchor.id, from)}
                  >
                    {row.anchor.workflow} · {row.anchor.externalId}
                  </Link>
                </div>
                <div className="min-w-0">
                  {row.downstream ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Downstream ·{" "}
                        {row.downstream.status === "Running"
                          ? "No terminal evidence"
                          : row.downstream.status}
                      </p>
                      <Link
                        className="block min-h-9 break-all text-primary underline-offset-4 hover:underline"
                        href={runInvestigationPath(row.downstream.id, from)}
                      >
                        {row.downstream.workflow} · {row.downstream.externalId}
                      </Link>
                      <p className="break-words text-xs text-muted-foreground">
                        Revision {row.downstream.revision ?? "not reported"} ·
                        Release {row.downstream.release ?? "not reported"}
                      </p>
                    </>
                  ) : (
                    <p>No unambiguous downstream execution selected.</p>
                  )}
                </div>
              </div>
              {row.coverage === "known" && (
                <p className="break-words">
                  Reported count contribution: {row.numerator} /{" "}
                  {row.denominator}
                </p>
              )}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          {selection.evidence?.cursor && (
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  ...selection,
                  evidence: {
                    scope: page.query.scope,
                    coverage: page.query.coverage,
                  },
                })
              }
            >
              Restart evidence
            </Button>
          )}
          {nextCursor && (
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  ...selection,
                  evidence: {
                    scope: page.query.scope,
                    coverage: page.query.coverage,
                    cursor: nextCursor,
                  },
                })
              }
            >
              Next evidence page
            </Button>
          )}
        </div>
        <p className="text-xs leading-6 text-muted-foreground">{page.caveat}</p>
      </CardContent>
    </Card>
  )
}
