"use client"

import type { AppRouter } from "@flowmark/server/trpc"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  NativeSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import type { inferRouterOutputs } from "@trpc/server"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { StatusBadge } from "../shared/dashboard-components"
import { RunCompareChart } from "../reporting/insight-charts"
import { formatDuration, formatTimestamp } from "../shared/format"
import { getRunResultHighlights } from "./run-presentation"
import { durationDelta } from "./run-state"
import { Array as EffectArray } from "effect"
import { runInvestigationPath } from "./investigation-navigation"

type RunComparison = inferRouterOutputs<AppRouter>["run"]["compare"]

export function RunComparisonPanel({
  comparison,
  loading,
  error,
  source,
  replace = false,
}: {
  comparison?: RunComparison
  loading: boolean
  error?: string
  source?: string
  replace?: boolean
}) {
  const params = useSearchParams()
  const pathname = usePathname()
  const current = comparison?.current
  const peerCount = comparison?.peers.length ?? 0
  const vsMedian = durationDelta(
    current?.durationMs ?? null,
    comparison?.peerMedianDurationMs ?? null,
  )
  const vsP95 = durationDelta(
    current?.durationMs ?? null,
    comparison?.peerP95DurationMs ?? null,
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compared with up to 50 earlier runs</CardTitle>
        <CardDescription>
          Same workflow, strictly earlier by start timestamp and ID. Default:
          previous 30 days and matching environment, including
          missing-to-missing. No silent fallback. Comparison does not state a
          cause.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          action={pathname}
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const next = new URLSearchParams(params.toString())
            next.set("view", "compare")
            EffectArray.forEach(
              [
                "peerDays",
                "peerEnvironment",
                "peerRelease",
                "peerDimension",
                "peerValue",
              ],
              (key) => {
                const value = form.get(key)
                if (typeof value === "string") {
                  next.set(key, value)
                }
              },
            )
            window.history[replace ? "replaceState" : "pushState"](
              null,
              "",
              `${pathname}?${next}`,
            )
          }}
        >
          <input type="hidden" name="view" value="compare" />
          <label className="text-sm">
            Previous days
            <Input
              name="peerDays"
              type="number"
              min={1}
              max={90}
              defaultValue={params.get("peerDays") ?? "30"}
            />
          </label>
          <label className="text-sm">
            Peer environment
            <NativeSelect
              name="peerEnvironment"
              defaultValue={params.get("peerEnvironment") ?? "same"}
            >
              <option value="same">Same environment</option>
              <option value="all">
                All environments (explicit broadening)
              </option>
            </NativeSelect>
          </label>
          <label className="text-sm">
            Peer release
            <NativeSelect
              name="peerRelease"
              defaultValue={params.get("peerRelease") ?? "all"}
            >
              <option value="all">All releases</option>
              <option value="same">
                Same release (missing matches missing)
              </option>
            </NativeSelect>
          </label>
          <label className="text-sm">
            Declared dimension key
            <Input
              name="peerDimension"
              maxLength={128}
              defaultValue={params.get("peerDimension") ?? ""}
            />
          </label>
          <label className="text-sm">
            Declared dimension value
            <Input
              name="peerValue"
              maxLength={2048}
              defaultValue={params.get("peerValue") ?? ""}
            />
          </label>
          <Button type="submit">Apply peer selection</Button>
        </form>
        {comparison?.population && (
          <p className="text-sm">
            Eligible {comparison.population.eligible}; selected{" "}
            {comparison.population.selected} (cap 50), minimum descriptive
            sample {comparison.population.minimumSample}. Window:{" "}
            {comparison.population.days} days before this run, UTC; environment:{" "}
            {comparison.population.allEnvironments
              ? "all (explicit)"
              : (comparison.population.environment ?? "missing only")}
            ; release:{" "}
            {comparison.population.sameRelease
              ? (comparison.population.release ?? "missing only")
              : "all"}
            . Workload normalization unavailable: no validated stable
            input-volume definition. Recorded results are context, not inferred
            workload.
          </p>
        )}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              Could not load comparison: {error}
            </AlertDescription>
          </Alert>
        ) : loading ? (
          <p role="status">Loading comparison…</p>
        ) : !current || peerCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            No earlier runs of this workflow to compare yet.
          </p>
        ) : (
          <>
            {(peerCount < 5 ||
              (comparison.population?.durationObservations ?? 0) < 5) && (
              <Alert>
                <AlertTitle>Few peers</AlertTitle>
                <AlertDescription>
                  Selected {peerCount} earlier runs;{" "}
                  {comparison.population?.durationObservations ?? 0} have
                  terminal durations. Treat median and p95 as thin samples, not
                  a regression signal.
                </AlertDescription>
              </Alert>
            )}
            <RunCompareChart
              currentMs={current.durationMs}
              peerMedianMs={comparison.peerMedianDurationMs}
              peerP95Ms={comparison.peerP95DurationMs}
            />
            <dl className="grid gap-4 text-sm sm:grid-cols-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:font-medium">
              <div>
                <dt>This run</dt>
                <dd>{formatDuration(current.durationMs)}</dd>
              </div>
              <div>
                <dt>Peer median</dt>
                <dd>
                  {formatDuration(comparison.peerMedianDurationMs)}
                  {vsMedian != null && (
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      {vsMedian === 0
                        ? "Same as median"
                        : vsMedian > 0
                          ? `${formatDuration(vsMedian)} slower`
                          : `${formatDuration(Math.abs(vsMedian))} faster`}
                    </p>
                  )}
                </dd>
              </div>
              <div>
                <dt>Peer p95</dt>
                <dd>
                  {formatDuration(comparison.peerP95DurationMs)}
                  {vsP95 != null && (
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      {vsP95 > 0 ? "Above peer p95" : "At or below peer p95"}
                    </p>
                  )}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Peer run completion among finished peers:{" "}
              {comparison.peerSuccessRate == null
                ? "No finished peers"
                : `${comparison.peerSuccessRate}%`}
              . {peerCount} earlier runs in this comparison window.
            </p>
            {(comparison.operations?.length ?? 0) > 0 && (
              <section className="grid gap-3">
                <h3 className="text-sm font-semibold">Operations vs peers</h3>
                <p className="text-xs leading-6 text-muted-foreground">
                  Presence and duration differences in recorded operations (up
                  to 100 names, alphabetical). Absent means this run did not
                  record that operation name. Repeated names are occurrences,
                  not inferred retries. Total recorded work can exceed wall time
                  when operations overlap. The legacy peer median uses the
                  longest occurrence per peer for compatibility; it is not the
                  per-occurrence median.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operation</TableHead>
                      <TableHead>This run</TableHead>
                      <TableHead>Peer operation statistics</TableHead>
                      <TableHead>In peers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.operations.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell>
                          <span className="font-medium">{row.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {row.currentStatus}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p>
                            {row.currentOccurrenceCount ?? 0} occurrences;{" "}
                            {row.currentOpenCount ?? 0} open;{" "}
                            {row.currentFailedCount ?? 0} failed
                          </p>
                          <p>
                            Per-occurrence median{" "}
                            {formatDuration(
                              row.currentMedianOccurrenceDurationMs ?? null,
                            )}
                          </p>
                          <p>
                            Total recorded work{" "}
                            {formatDuration(
                              row.currentTotalRecordedDurationMs ?? null,
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Longest (legacy):{" "}
                            {formatDuration(row.currentDurationMs)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p>
                            Median of per-run occurrence medians:{" "}
                            {formatDuration(
                              row.peerMedianOccurrenceDurationMs ?? null,
                            )}
                          </p>
                          <p>
                            Median recorded work per present peer:{" "}
                            {formatDuration(
                              row.peerMedianTotalRecordedDurationMs ?? null,
                            )}
                          </p>
                          <p>
                            Longest-occurrence median (legacy):{" "}
                            {formatDuration(row.peerMedianDurationMs)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-1">
                            <span>
                              {row.peerPresentCount}/{peerCount};{" "}
                              {row.peerOpenRunCount ?? 0} with open;{" "}
                              {row.peerFailedRunCount ?? 0} with failures
                            </span>
                            {row.peerRunIds.length > 0 && (
                              <span className="flex flex-wrap gap-1 text-xs">
                                {row.peerRunIds.slice(0, 3).map((runId) => (
                                  <Link
                                    key={runId}
                                    className="font-mono text-muted-foreground hover:text-highlight hover:underline"
                                    href={runInvestigationPath(runId, source)}
                                    replace={replace}
                                    scroll={false}
                                  >
                                    {runId.slice(0, 8)}
                                  </Link>
                                ))}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started (UTC)</TableHead>
                  <TableHead>Reported result</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Delta vs this run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.peers.map((peer) => {
                  const delta = durationDelta(
                    current.durationMs,
                    peer.durationMs,
                  )
                  const highlights = getRunResultHighlights(peer.result ?? {})
                  return (
                    <TableRow key={peer.id}>
                      <TableCell>
                        <Link
                          className="break-all font-mono text-xs hover:text-highlight hover:underline"
                          href={runInvestigationPath(peer.id, source)}
                          replace={replace}
                          scroll={false}
                        >
                          <code>{peer.externalId}</code>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={peer.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTimestamp(peer.startedAt)}
                      </TableCell>
                      <TableCell>
                        {highlights.length > 0
                          ? highlights
                              .map((item) => `${item.label}: ${item.value}`)
                              .join(" · ")
                          : "—"}
                      </TableCell>
                      <TableCell>{formatDuration(peer.durationMs)}</TableCell>
                      <TableCell>
                        {delta == null
                          ? "—"
                          : delta === 0
                            ? "Same"
                            : delta > 0
                              ? `${formatDuration(delta)} faster than this run`
                              : `${formatDuration(Math.abs(delta))} slower than this run`}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
