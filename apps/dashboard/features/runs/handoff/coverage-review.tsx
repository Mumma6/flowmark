"use client"

import { useQuery } from "@tanstack/react-query"
import { Button, Input, Textarea } from "@flowmark/ui"
import { useMemo, useState } from "react"
import { createDashboardTRPCClient } from "../../platform/api-browser-client"
import { CopyButton, ViewLink } from "../../shared/dashboard-components"
import { runInvestigationPath } from "../investigation/investigation-navigation"

const confirmationStates = {
  "met-on-time": "Confirmation recorded on time",
  "met-late": "Confirmation recorded after the deadline",
  pending: "Confirmation unverified. Waiting for recorded settlement.",
  overdue: "Confirmation unverified. The recorded deadline passed.",
  cancelled: "Confirmation cancelled",
  unmatched: "Confirmation unverified. The declaration is missing.",
}

export function CoverageReview({
  projectId,
  workflow,
}: {
  projectId: string
  workflow: string
}) {
  const client = useMemo(
    () => createDashboardTRPCClient(projectId),
    [projectId],
  )
  const [question, setQuestion] = useState("")
  const [revision, setRevision] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [since, setSince] = useState<string>()
  const [selection, setSelection] = useState<{
    runId: string
    expectationId: string
  }>()
  const [verifiedSince, setVerifiedSince] = useState<string>()
  const runs = useQuery({
    queryKey: ["coverage-runs", projectId, workflow, since, revision],
    queryFn: ({ signal }) =>
      client.run.list.query(
        {
          workflow,
          startedAfter: since,
          limit: 5,
          ...(revision.trim() ? { definitionRevision: revision.trim() } : {}),
        },
        { signal },
      ),
    enabled: Boolean(since),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
    retry: false,
  })
  const evidence = useQuery({
    queryKey: ["coverage-confirmation", projectId, selection],
    queryFn: ({ signal }) =>
      client.run.expectationsPage.query(
        {
          runId: selection!.runId,
          expectationId: selection!.expectationId,
          limit: 1,
        },
        { signal },
      ),
    enabled: Boolean(selection),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
    retry: false,
  })
  const recorded = evidence.data?.expectations[0]
  const prompt = [
    `Use the local repository to improve evidence for workflow ${JSON.stringify(workflow)}.`,
    `Investigation question: ${JSON.stringify(question.trim())}.`,
    revision.trim() &&
      `Expected definition revision: ${JSON.stringify(revision.trim())}.`,
    confirmation.trim() &&
      `Proposed confirmation identifier: ${JSON.stringify(confirmation.trim())}.`,
    "Separate recorded evidence, source inferences and unknowns. Inspect the first relevant I/O boundary and use the installed SDK and runtime docs.",
    "Propose the smallest patch, collected fields, source revision and verification steps. Show the diff and wait for developer approval before editing.",
    "Preserve application returns, original errors and concurrency. Verify success, partial or error behavior, and the independent confirmation only where safely exercised.",
    "Use Studio or authorized MCP to read persisted runs. Report which paths ran and what was read. Leave unexercised callbacks unverified. Use a deadline only when its business meaning is known.",
  ]
    .filter(Boolean)
    .join("\n")
  return (
    <details className="rounded-lg border border-border p-4 text-sm">
      <summary className="cursor-pointer font-medium">
        Close an evidence gap
      </summary>
      <div className="mt-3 grid gap-3">
        <p className="text-muted-foreground">
          Define one missing answer, review the smallest SDK change, then check
          what was recorded after the change.
        </p>
        <label className="grid gap-1">
          What is missing?
          <Textarea
            rows={2}
            maxLength={400}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
        <label className="grid gap-1">
          Definition revision (optional)
          <Input
            maxLength={64}
            value={revision}
            onChange={(event) => {
              setRevision(event.target.value)
              setSelection(undefined)
              setSince(undefined)
              setVerifiedSince(undefined)
            }}
          />
        </label>
        <label className="grid gap-1">
          Confirmation ID (optional)
          <Input
            maxLength={128}
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value)
              setSelection(undefined)
            }}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {question.trim() && (
            <CopyButton label="Copy SDK patch brief" value={prompt} />
          )}
          <ViewLink href="/settings?section=setup">Manual SDK setup</ViewLink>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSince(new Date().toISOString())
              setSelection(undefined)
              setVerifiedSince(undefined)
            }}
          >
            Start verification now
          </Button>
          {since && (
            <Button
              type="button"
              variant="outline"
              disabled={runs.isFetching}
              onClick={() => void runs.refetch()}
            >
              Check for new runs
            </Button>
          )}
        </div>
        {since && (
          <p>
            Checking runs started after <time dateTime={since}>{since}</time>.
          </p>
        )}
        {verifiedSince && (
          <p role="status">
            Recorded run found during check at{" "}
            <time dateTime={verifiedSince}>{verifiedSince}</time>.
          </p>
        )}
        {runs.isError && (
          <p role="alert">
            The run check was unavailable. Try again to verify delivery.
          </p>
        )}
        {since && runs.isSuccess && runs.data.runs.length === 0 && (
          <p role="status">No matching run has been recorded in this window.</p>
        )}
        {runs.data?.nextCursor && (
          <p>
            Showing the five latest matching runs. Open workflow history to
            inspect earlier examples.
          </p>
        )}
        {runs.data?.runs.map((run) => (
          <div key={run.id} className="grid gap-1 rounded-md border p-3">
            <p>
              {run.status === "Running" ? "No final outcome" : run.status}
              {run.outcome && ` · Reported outcome: ${run.outcome}`}
            </p>
            <div className="flex flex-wrap gap-2">
              <ViewLink href={runInvestigationPath(run.id)}>
                Inspect recorded run
              </ViewLink>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setVerifiedSince(new Date(runs.dataUpdatedAt).toISOString())
                  if (confirmation.trim()) {
                    const expectationId = confirmation.trim()
                    if (
                      selection?.runId === run.id &&
                      selection.expectationId === expectationId
                    ) {
                      void evidence.refetch()
                    } else {
                      setSelection({ runId: run.id, expectationId })
                    }
                  }
                }}
              >
                {confirmation.trim()
                  ? "Check this confirmation"
                  : "Mark run reviewed"}
              </Button>
            </div>
            {selection?.runId === run.id && (
              <>
                {evidence.isFetching && (
                  <p role="status">Checking confirmation…</p>
                )}
                {recorded && !evidence.isFetching && !evidence.isError && (
                  <p>
                    {confirmationStates[recorded.state]}
                    {recorded.deadlineAt
                      ? ` · Recorded deadline: ${recorded.deadlineAt}`
                      : " · No deadline recorded"}
                  </p>
                )}
                {evidence.isSuccess && !recorded && (
                  <p>
                    Confirmation unverified. No matching declaration was
                    returned.
                  </p>
                )}
                {evidence.isError && (
                  <p role="alert">Confirmation unverified. The read failed.</p>
                )}
              </>
            )}
          </div>
        ))}
        {!selection && (
          <p className="text-muted-foreground">
            External callbacks remain unverified until their confirmation is
            checked.
          </p>
        )}
      </div>
    </details>
  )
}
