"use client"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@flowmark/ui"
import { CaptureRun } from "../evidence-captures/capture-run"
import { BusinessRunView } from "@flowmark/ui/business-run"
import type { BusinessEvidence, BusinessEvidenceQuery } from "@flowmarkdev/core"
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
          <BusinessInsightForm meaning={data.meaning} choose={choose} />
        </>
      ) : null}
      {data.kind === "runs" ? (
        <Card>
          <CardHeader>
            <CardTitle>{data.total} recorded runs</CardTitle>
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
            <CardTitle>
              {data.report.field.label} · reported comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {data.report.windows.map((w) => (
              <section
                className="rounded-lg border border-border p-4"
                key={w.scope}
              >
                <h3 className="font-semibold capitalize">{w.scope}</h3>
                <p className="text-2xl">
                  {w.total ?? "No permitted numeric total"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {w.knownRuns} known result observations / {w.totalRuns} runs.{" "}
                  {w.missingResult} missing results, {w.missingField} missing
                  fields, {w.incompatibleRevision} incompatible revisions,{" "}
                  {w.wrongType} invalid types, {w.unknownCategory} unknown
                  categories.
                </p>
                {w.categories.map((c) => (
                  <p className="text-sm" key={c.value}>
                    {c.value}: {c.runs} runs
                    {c.total === null ? "" : ` · ${c.total}`}
                  </p>
                ))}
              </section>
            ))}
            <p className="text-xs text-muted-foreground">
              Exact windows: {data.report.query.currentStartedAfter} –{" "}
              {data.report.query.currentStartedBefore}; previous{" "}
              {data.report.query.previousStartedAfter} –{" "}
              {data.report.query.previousStartedBefore}. Missing observations
              are not zero business value.
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
