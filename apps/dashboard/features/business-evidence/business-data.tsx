"use client"
import {
  MeaningProposals,
  ProposeMeaning,
} from "../results/proposals/meaning-proposals"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@flowmark/ui"
import { CaptureRun } from "../evidence-captures/capture-run"
import { BusinessRunView } from "@flowmark/ui/business-run"
import type { BusinessEvidence, BusinessEvidenceQuery } from "@flowmarkdev/core"
import { BusinessPeriodChange } from "./business-period-change"
import { BusinessJourneyForm, BusinessInsightForm } from "./question-forms"
import { SaveInvestigation } from "../investigations/save-investigation"
export function BusinessData({
  value,
  selection,
  choose,
  projectId,
}: {
  readonly value: BusinessEvidence
  readonly selection: BusinessEvidenceQuery
  readonly choose: (selection: BusinessEvidenceQuery) => void
  readonly projectId: string
}) {
  const data = value.data
  return (
    <>
      {data.kind === "overview" ? (
        <>
          <BusinessInsightForm meaning={data.meaning} choose={choose} />
          <Card>
            <CardHeader>
              <CardTitle>Project activity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.workflows.length === 0 ? (
                <p className="text-sm">
                  No workflow activity has been recorded.
                </p>
              ) : (
                data.workflows.map((w) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                    key={w.name}
                  >
                    <div className="min-w-0">
                      <h3 className="break-all font-medium">{w.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {w.runs} reported runs ·{" "}
                        {w.completedPercent === null
                          ? "No terminal baseline"
                          : `${w.completedPercent}% completed terminals`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        choose({
                          kind: "runs",
                          query: { workflow: w.name, limit: 25 },
                        })
                      }
                    >
                      Inspect activity
                    </Button>
                  </div>
                ))
              )}
              {data.continued ? (
                <p className="text-sm text-muted-foreground">
                  Showing the first 100 workflows. Use an exact published
                  workflow below.
                </p>
              ) : null}
            </CardContent>
          </Card>
          <BusinessJourneyForm meaning={data.meaning} choose={choose} />
        </>
      ) : null}
      {data.kind === "runs" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {data.total}{" "}
              {selection.kind === "runs" && selection.query.publishedCount
                ? "contributing runs"
                : "recorded runs"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.runs.length === 0 ? (
              <p>No permitted activity matches this selection.</p>
            ) : (
              data.runs.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <div className="grid min-w-0 gap-1">
                    <strong className="break-all">{run.workflow}</strong>
                    <span>
                      {run.status === "Running"
                        ? "No terminal reported"
                        : run.status}{" "}
                      · {run.outcome ?? "No business outcome"}
                    </span>
                    <time dateTime={run.startedAt}>
                      {new Date(run.startedAt).toLocaleString()}
                    </time>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => choose({ kind: "run", runId: run.id })}
                  >
                    Inspect result
                  </Button>
                </div>
              ))
            )}
            {data.nextCursor && selection.kind === "runs" ? (
              <Button
                variant="outline"
                onClick={() =>
                  choose({
                    ...selection,
                    query: {
                      ...selection.query,
                      cursor: data.nextCursor ?? undefined,
                    },
                  })
                }
              >
                Next activity page
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {data.kind === "run" ? (
        <>
          <BusinessRunView
            summary={data.summary}
            fields={data.fields}
            references={data.references}
            revision={value.projection.publicationRevision}
            observedAt={value.projection.observedAt}
          />
          <ProposeMeaning
            key={`${projectId}:${data.summary.id}:${value.projection.publicationRevision}`}
            projectId={projectId}
            runId={data.summary.id}
            fields={data.fields}
          />
          <MeaningProposals key={projectId} projectId={projectId} />
          <CaptureRun
            key={`${projectId}:${data.summary.id}`}
            projectId={projectId}
            runId={data.summary.id}
          />
          <div className="flex flex-wrap gap-2">
            <SaveInvestigation
              selection={{
                version: 1,
                kind: "run",
                projectId,
                runId: data.summary.id,
                section: "events",
              }}
            />
            <Button
              variant="outline"
              onClick={() =>
                choose({ kind: "compare", runId: data.summary.id, days: 30 })
              }
            >
              Compare recorded peers
            </Button>
            {data.references.map((ref) => (
              <Button
                key={ref.key}
                variant="outline"
                onClick={() =>
                  choose({
                    kind: "journey",
                    query: {
                      workflow: data.summary.workflow,
                      key: ref.key,
                      value: ref.value,
                      namespaces: [
                        { workflow: data.summary.workflow, key: ref.key },
                      ],
                    },
                  })
                }
              >
                Follow {ref.key}
              </Button>
            ))}
          </div>
        </>
      ) : null}
      {data.kind === "journey" && selection.kind === "journey" ? (
        <Card>
          <CardHeader>
            <CardTitle>Reported journey · {data.namespace.key}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="break-all text-sm">
              {data.value} · {data.state}
            </p>
            {data.state === "NotFound" ? (
              <p>No matching permitted reference was observed.</p>
            ) : null}
            {data.candidates.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                onClick={() =>
                  choose({
                    ...selection,
                    query: {
                      ...selection.query,
                      anchorRunId: c.id,
                      candidateCursor: undefined,
                      cursor: undefined,
                    },
                  })
                }
              >
                Select {c.workflow} · {new Date(c.startedAt).toLocaleString()}
              </Button>
            ))}
            {data.nodes.map((n) => (
              <div
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <span className="break-all">
                  {n.workflow} · {n.outcome ?? n.status} · depth {n.depth}
                </span>
                <Button
                  variant="outline"
                  onClick={() => choose({ kind: "run", runId: n.id })}
                >
                  Inspect result
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              {data.edges.length} recorded links. {data.coverage}{" "}
              {data.bounds.traversalTruncated ? "Traversal is truncated." : ""}
            </p>
            {data.nextCursor ? (
              <Button
                onClick={() =>
                  choose({
                    ...selection,
                    query: {
                      ...selection.query,
                      cursor: data.nextCursor ?? undefined,
                    },
                  })
                }
              >
                Next journey page
              </Button>
            ) : null}
            {data.nextCandidateCursor ? (
              <Button
                onClick={() =>
                  choose({
                    ...selection,
                    query: {
                      ...selection.query,
                      candidateCursor: data.nextCandidateCursor ?? undefined,
                    },
                  })
                }
              >
                More candidate anchors
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {data.kind === "insights" ? (
        <Card>
          <CardHeader>
            <CardTitle>{data.report.field.label}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <BusinessPeriodChange report={data.report} />
            {data.report.windows.map((w) => {
              const { query, field } = data.report
              const previous = w.scope === "previous"
              const startedAfter = previous
                ? query.previousStartedAfter
                : query.currentStartedAfter
              const startedBefore = previous
                ? query.previousStartedBefore
                : query.currentStartedBefore
              return (
                <section
                  className="grid gap-2 rounded-lg border border-border p-4"
                  key={w.scope}
                >
                  <h3 className="font-semibold capitalize">{w.scope} period</h3>
                  <p className="text-sm text-muted-foreground">
                    {startedAfter} to {startedBefore} (end excluded)
                  </p>
                  <p className="text-2xl">
                    {w.total === null ? (
                      "No reported total"
                    ) : (
                      <>
                        {w.total}
                        {field.unit && (
                          <span className="text-base"> {field.unit}</span>
                        )}
                      </>
                    )}
                  </p>
                  <p className="text-sm">
                    {w.failedRuns.toLocaleString()} failed of{" "}
                    {w.finishedRuns.toLocaleString()} terminal runs ·{" "}
                    {w.openRuns.toLocaleString()} without a terminal report
                  </p>
                  {(w.scope === "current" || previous) && w.failedRuns > 0 && (
                    <Button
                      variant="outline"
                      className="justify-self-start"
                      aria-label={`View failed runs for the ${w.scope} period`}
                      onClick={() =>
                        choose({
                          kind: "runs",
                          query: {
                            workflow: query.workflow,
                            startedAfter,
                            startedBeforeExclusive: startedBefore,
                            status: "Failed",
                            businessKey: query.businessKey,
                            businessValue: query.businessValue,
                            limit: 25,
                          },
                        })
                      }
                    >
                      View failed runs
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {w.knownRuns} of {w.totalRuns} recorded runs reported a
                    usable result.
                  </p>
                  {w.knownRuns !== w.totalRuns && (
                    <details className="text-sm text-muted-foreground">
                      <summary className="cursor-pointer">
                        Why some runs were excluded
                      </summary>
                      <ul className="list-disc pl-5">
                        {w.openRuns > 0 && (
                          <li>{w.openRuns} without a recorded finish</li>
                        )}
                        {w.missingResult > 0 && (
                          <li>{w.missingResult} without a reported result</li>
                        )}
                        {w.missingField > 0 && (
                          <li>{w.missingField} without this measure</li>
                        )}
                        {w.incompatibleRevision > 0 && (
                          <li>
                            {w.incompatibleRevision} under a different or
                            unknown definition
                          </li>
                        )}
                        {w.wrongType > 0 && (
                          <li>{w.wrongType} with an invalid value</li>
                        )}
                        {w.unknownCategory > 0 && (
                          <li>
                            {w.unknownCategory} with an unrecognized category
                          </li>
                        )}
                      </ul>
                    </details>
                  )}
                  {(w.scope === "current" || previous) &&
                    field.kind === "count" &&
                    query.businessKey === undefined &&
                    w.knownRuns > 0 && (
                      <Button
                        variant="outline"
                        className="justify-self-start"
                        aria-label={`View contributing runs for the ${w.scope} period`}
                        onClick={() =>
                          choose({
                            kind: "runs",
                            query: {
                              workflow: query.workflow,
                              startedAfter,
                              startedBefore,
                              publishedCount: {
                                revision: query.revision,
                                path: field.path,
                              },
                              limit: 25,
                            },
                          })
                        }
                      >
                        View contributing runs
                      </Button>
                    )}
                  {w.categories.map((c) => (
                    <p className="text-sm" key={c.value}>
                      {c.value}: {c.runs} runs
                      {c.total === null ? "" : ` · ${c.total}`}
                    </p>
                  ))}
                </section>
              )
            })}
            <p className="text-xs text-muted-foreground">
              Totals use the results reported by the application. Missing
              observations do not count as zero.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {data.kind === "compare" ? (
        <Card>
          <CardHeader>
            <CardTitle>Recorded peer comparison · {data.days} days</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p>
              {data.selected} selected peers / {data.eligible} eligible. Median
              recorded duration: {data.medianDurationMs ?? "unavailable"} ms.
              Terminal completion: {data.completedPercent ?? "unavailable"}%.
            </p>
            <p className="text-sm text-muted-foreground">
              All environments; release and operation diagnostics are withheld.
              Comparisons do not establish cause.
            </p>
            {data.peers.map((peer) => (
              <Button
                key={peer.id}
                variant="outline"
                onClick={() => choose({ kind: "run", runId: peer.id })}
              >
                {peer.workflow} · {peer.outcome ?? peer.status}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
