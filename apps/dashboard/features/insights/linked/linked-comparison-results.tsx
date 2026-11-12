"use client"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import { Array, Option } from "effect"
import {
  LINKED_COVERAGE,
  type LinkedComparison,
  type LinkedComparisonSelection,
  type LinkedCoverage,
} from "@flowmarkdev/core"
import {
  linkedAvailabilityMessage,
  linkedCoverageLabels,
  linkedRatioLabel,
} from "./linked-presentation"

export function LinkedComparisonResults({
  report,
  inspect,
}: {
  report: LinkedComparison
  inspect: (scope: "current" | "previous", coverage?: LinkedCoverage) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reported ratio across linked attempts</CardTitle>
        <CardDescription className="break-words">
          {report.query.upstreamWorkflow} → {report.query.downstreamWorkflow} ·{" "}
          {report.numeratorLabel} / {report.denominatorLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-5">
        <p role="status" className="text-sm leading-6">
          {linkedAvailabilityMessage(report.comparison)}
        </p>
        {report.comparison.available && report.comparison.delta !== null && (
          <p className="text-xl font-semibold">
            {report.comparison.delta > 0 ? "+" : ""}
            {(report.comparison.delta * 100).toFixed(2)} percentage points
          </p>
        )}
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {(["previous", "current"] as const).map((scope) =>
            Option.match(
              Array.findFirst(
                report.windows,
                (window) => window.scope === scope,
              ),
              {
                onNone: () => (
                  <p key={scope} role="alert">
                    {scope} window is unavailable.
                  </p>
                ),
                onSome: (window) => (
                  <section
                    key={scope}
                    className="grid min-w-0 gap-2 rounded-lg border border-border p-4"
                  >
                    <h3 className="font-medium">
                      {scope === "current"
                        ? "Current window"
                        : "Previous window"}
                    </h3>
                    <p className="break-words text-xs text-muted-foreground">
                      {scope === "current"
                        ? report.query.currentStartedAfter
                        : report.query.previousStartedAfter}{" "}
                      to{" "}
                      {scope === "current"
                        ? report.query.currentStartedBefore
                        : report.query.previousStartedBefore}{" "}
                      (end exclusive)
                    </p>
                    <p className="text-2xl font-semibold">
                      {linkedRatioLabel(window.ratio)}
                    </p>
                    <p className="break-words text-sm">
                      {window.numerator ?? "Unknown"} /{" "}
                      {window.denominator ?? "Unknown"} reported items
                    </p>
                    <p className="text-sm">
                      {window.knownPairs} known pairs / {window.anchors}{" "}
                      retained upstream attempts
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {window.failedKnownPairs} known pairs include a
                      technically failed downstream run. Technical completion
                      and reported business results are distinct.
                    </p>
                    <Button
                      variant="outline"
                      className="justify-self-start"
                      onClick={() => inspect(scope)}
                      disabled={window.anchors === 0}
                    >
                      Inspect {scope} attempts
                    </Button>
                  </section>
                ),
              },
            ),
          )}
        </div>
        <div className="min-w-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evidence coverage</TableHead>
                <TableHead>Previous</TableHead>
                <TableHead>Current</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LINKED_COVERAGE.map((coverage) => (
                <TableRow key={coverage}>
                  <TableCell className="whitespace-normal">
                    {linkedCoverageLabels[coverage]}
                  </TableCell>
                  {(["previous", "current"] as const).map((scope) => {
                    const count = Option.match(
                      Array.findFirst(
                        report.windows,
                        (window) => window.scope === scope,
                      ),
                      {
                        onNone: () => null,
                        onSome: (window) => window.coverage[coverage],
                      },
                    )
                    return (
                      <TableCell key={scope}>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Inspect ${scope}: ${count ?? "Unavailable"} ${linkedCoverageLabels[coverage]}`}
                          disabled={count === null || count === 0}
                          onClick={() => inspect(scope, coverage)}
                        >
                          {count ?? "Unavailable"}
                        </Button>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          {report.caveat}
        </p>
        <p className="text-xs leading-6 text-muted-foreground">
          Only direct parent links with unambiguous retained identities are
          paired. Multiple linked attempts are excluded, even if only one
          matches the selected release or revision. Read limits:{" "}
          {report.bounds.maximumAnchorsPerWindow.toLocaleString()} anchors per
          window and {report.bounds.maximumFallbackEvents.toLocaleString()}{" "}
          fallback events.
        </p>
      </CardContent>
    </Card>
  )
}

export type LinkedEvidenceSelection = NonNullable<
  LinkedComparisonSelection["evidence"]
>
