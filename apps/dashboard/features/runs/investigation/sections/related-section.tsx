"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import Link from "next/link"
import { CopyButton } from "../../../shared/dashboard-components"
import { RunRelatedRunsPanel } from "../panels/run-related-runs-panel"
import type { InvestigationSectionProps } from "../investigation-types"

export function RelatedSection({
  source,
  relatedPage,
  first,
  runId,
  contextual,
}: Pick<
  InvestigationSectionProps,
  "source" | "relatedPage" | "first" | "runId" | "contextual"
>) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Explicit run links</CardTitle>
          <CardDescription>
            Application-declared associations, not proof of causation or a
            distributed trace. Browser-supplied links are untrusted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="mb-5 grid gap-4 text-sm sm:grid-cols-2 [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all">
            <div>
              <dt>Correlation ID</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {first.correlationId ? (
                  <>
                    <Link
                      className="font-medium hover:text-highlight hover:underline"
                      href={`/runs?search=${encodeURIComponent(first.correlationId)}`}
                    >
                      <code>{first.correlationId}</code>
                    </Link>
                    <CopyButton value={first.correlationId} label="Copy" />
                  </>
                ) : (
                  <code>Not supplied</code>
                )}
              </dd>
            </div>
            <div>
              <dt>Parent run ID</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {first.parentRunId ? (
                  <>
                    <Link
                      className="font-medium hover:text-highlight hover:underline"
                      href={`/runs?search=${encodeURIComponent(first.parentRunId)}`}
                    >
                      <code>{first.parentRunId}</code>
                    </Link>
                    <CopyButton value={first.parentRunId} label="Copy" />
                  </>
                ) : (
                  <code>Not supplied</code>
                )}
              </dd>
            </div>
          </dl>
          <RunRelatedRunsPanel
            runId={runId}
            source={source}
            replace={contextual}
            retryOf={first.retryOf}
            correlationId={first.correlationId}
            parentRunId={first.parentRunId}
            page={relatedPage}
          />
        </CardContent>
      </Card>
    </>
  )
}
