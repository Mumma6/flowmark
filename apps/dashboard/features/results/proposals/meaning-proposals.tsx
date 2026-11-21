"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button, Input, Textarea } from "@flowmark/ui"
import type { PublishedResultField } from "@flowmarkdev/core"
import { useMemo, useState } from "react"
import { authClient } from "../../auth/auth-client"
import { createDashboardTRPCClient } from "../../platform/api-browser-client"
import type { RouterOutputs } from "../../platform/api-types"
import { CopyButton } from "../../shared/dashboard-components"

const queryKey = (projectId: string) =>
  ["meaning-proposals", projectId] as const
type Proposal = NonNullable<
  RouterOutputs["sharedInvestigations"]["listProposals"]["items"][number]["proposal"]
>

export function ProposeMeaning({
  projectId,
  runId,
  fields,
}: {
  projectId: string
  runId: string
  fields: readonly PublishedResultField[]
}) {
  const client = useMemo(
    () => createDashboardTRPCClient(projectId),
    [projectId],
  )
  const cache = useQueryClient()
  const available = fields.filter((field) => field.state === "available")
  const [fieldPath, setFieldPath] = useState("")
  const [label, setLabel] = useState("")
  const [reason, setReason] = useState("")
  const [id, setId] = useState<string>()
  const selected = available.find(
    (field) => JSON.stringify(field.path) === fieldPath,
  )
  const submit = useMutation({
    mutationFn: (command: {
      id: string
      path: readonly string[]
      label: string
      reason: string
    }) =>
      client.sharedInvestigations.submitProposal.mutate({
        projectId,
        command: { ...command, runId },
      }),
    onSuccess: () =>
      void cache.invalidateQueries({ queryKey: queryKey(projectId) }),
  })
  if (!available.length) {
    return null
  }
  return (
    <details className="rounded-lg border p-4 text-sm">
      <summary className="cursor-pointer font-medium">
        Propose a label change
      </summary>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!selected || !label.trim() || !reason.trim()) {
            return
          }
          const requestId = id ?? crypto.randomUUID()
          setId(requestId)
          submit.mutate({
            id: requestId,
            path: selected.path,
            label: label.trim(),
            reason: reason.trim(),
          })
        }}
      >
        <label className="grid gap-1">
          Published result
          <select
            className="rounded-md border bg-background p-2"
            value={fieldPath}
            disabled={submit.isPending || submit.isSuccess}
            onChange={(event) => {
              setFieldPath(event.target.value)
              setId(undefined)
            }}
          >
            <option value="">Choose a field</option>
            {available.map((field) => (
              <option
                key={JSON.stringify(field.path)}
                value={JSON.stringify(field.path)}
              >
                {field.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          Proposed label
          <Input
            value={label}
            maxLength={120}
            disabled={submit.isPending || submit.isSuccess}
            onChange={(event) => {
              setLabel(event.target.value)
              setId(undefined)
            }}
          />
        </label>
        <label className="grid gap-1">
          Reason for the change
          <Textarea
            value={reason}
            maxLength={500}
            rows={2}
            disabled={submit.isPending || submit.isSuccess}
            onChange={(event) => {
              setReason(event.target.value)
              setId(undefined)
            }}
          />
        </label>
        <Button
          type="submit"
          className="justify-self-start"
          disabled={
            submit.isPending ||
            submit.isSuccess ||
            !selected ||
            !label.trim() ||
            !reason.trim()
          }
        >
          {submit.isPending ? "Sending…" : "Send to project owner"}
        </Button>
        {submit.isError && <p role="alert">{submit.error.message}</p>}
        {submit.isSuccess && (
          <p role="status">Proposal sent. Review its status below.</p>
        )}
      </form>
    </details>
  )
}

function ProposalExample({
  projectId,
  proposal,
}: {
  projectId: string
  proposal: Proposal
}) {
  const client = useMemo(
    () => createDashboardTRPCClient(projectId),
    [projectId],
  )
  const sessionId = authClient.useSession().data?.session.id
  const example = useQuery({
    queryKey: [
      "meaning-proposal-example",
      projectId,
      sessionId,
      proposal.command.runId,
    ],
    enabled: Boolean(sessionId),
    queryFn: ({ signal }) =>
      client.businessEvidence.read.query(
        { kind: "run", runId: proposal.command.runId },
        { signal },
      ),
    gcTime: 0,
    refetchInterval: false,
    retry: false,
  })
  const field =
    example.data?.data.kind === "run" &&
    example.data.data.fields.find(
      (value) =>
        value.revision === proposal.revision &&
        JSON.stringify(value.path) === JSON.stringify(proposal.command.path),
    )
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      <div>
        <h4 className="font-medium">Original recorded example</h4>
        {example.isPending && <p role="status">Loading published example…</p>}
        {field && field.state === "available" && (
          <p className="break-words">
            {field.label} · {JSON.stringify(field.value)} {field.unit}
          </p>
        )}
        {!example.isPending && (!field || field.state !== "available") && (
          <p>Published example unavailable.</p>
        )}
      </div>
      <div>
        <h4 className="font-medium">Proposed interpretation</h4>
        <p className="break-words">
          {proposal.command.label}
          {proposal.unit && ` · ${proposal.unit}`}
        </p>
        <p className="text-muted-foreground">
          Same field and eligibility. Proposed label only.
        </p>
      </div>
    </div>
  )
}

export function MeaningProposals({ projectId }: { projectId: string }) {
  const client = useMemo(
    () => createDashboardTRPCClient(projectId),
    [projectId],
  )
  const cache = useQueryClient()
  const [open, setOpen] = useState(false)
  const [examining, setExamining] = useState<string>()
  const sessionId = authClient.useSession().data?.session.id
  const proposals = useQuery({
    queryKey: [...queryKey(projectId), sessionId],
    queryFn: ({ signal }) =>
      client.sharedInvestigations.listProposals.query(
        { projectId },
        { signal },
      ),
    enabled: open && Boolean(sessionId),
    gcTime: 0,
    refetchInterval: false,
    retry: false,
  })
  const resolve = useMutation({
    mutationFn: ({
      id,
      resolution,
    }: {
      id: string
      resolution: "accepted" | "rejected"
    }) =>
      client.sharedInvestigations.resolveProposal.mutate({
        projectId,
        id,
        resolution,
      }),
    onSuccess: () =>
      void cache.invalidateQueries({ queryKey: queryKey(projectId) }),
  })
  return (
    <details
      className="rounded-lg border p-4 text-sm"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium">
        Meaning proposals
      </summary>
      {open && (
        <div className="mt-4 grid gap-3">
          {proposals.isPending && <p role="status">Loading proposals…</p>}
          {proposals.isError && (
            <p role="alert">
              Proposals unavailable.{" "}
              <Button
                variant="outline"
                onClick={() => void proposals.refetch()}
              >
                Retry
              </Button>
            </p>
          )}
          {proposals.isSuccess && proposals.data.items.length === 0 && (
            <p>No proposals to review.</p>
          )}
          {resolve.isError && <p role="alert">{resolve.error.message}</p>}
          {proposals.data?.items.map(
            ({ id, proposal, resolution, publicationChanged }) => (
              <article className="grid gap-2 rounded-md border p-3" key={id}>
                <p className="font-medium">
                  {resolution === "accepted"
                    ? "Accepted"
                    : resolution === "rejected"
                      ? "Rejected"
                      : "Pending review"}
                </p>
                {publicationChanged && (
                  <p>
                    The publication changed. Ask for a new proposal from a
                    current example.
                  </p>
                )}
                {proposal && (
                  <>
                    <p className="break-words">
                      {proposal.beforeLabel} → {proposal.command.label} ·{" "}
                      {proposal.workflow} / {proposal.revision}
                    </p>
                    <p className="break-words text-muted-foreground">
                      {proposal.command.reason}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setExamining(examining === id ? undefined : id)
                        }
                      >
                        {examining === id ? "Hide example" : "Review example"}
                      </Button>
                      {proposals.data.canResolve && !resolution && (
                        <>
                          <Button
                            disabled={resolve.isPending}
                            size="sm"
                            onClick={() =>
                              resolve.mutate({ id, resolution: "accepted" })
                            }
                          >
                            Accept proposal
                          </Button>
                          <Button
                            disabled={resolve.isPending}
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              resolve.mutate({ id, resolution: "rejected" })
                            }
                          >
                            Reject proposal
                          </Button>
                        </>
                      )}
                      {proposals.data.canResolve &&
                        resolution === "accepted" &&
                        proposal.codeOwned && (
                          <CopyButton
                            label="Copy source patch brief"
                            value={[
                              `Find the definition for workflow ${JSON.stringify(proposal.workflow)} and revision ${JSON.stringify(proposal.revision)} in the local repository.`,
                              `Propose a new revision changing only the label at JSON path ${JSON.stringify(proposal.command.path)} to ${JSON.stringify(proposal.command.label)}.`,
                              "Show the patch for review before editing. Preview the resulting definition in Studio before applying. Preserve the original definition and execution history.",
                            ].join("\n")}
                          />
                        )}
                    </div>
                    {proposals.data.canResolve &&
                      resolution === "accepted" &&
                      !proposal.codeOwned && (
                        <p className="text-muted-foreground">
                          Create a new result revision in Studio to apply the
                          accepted label.
                        </p>
                      )}
                    {examining === id && (
                      <ProposalExample
                        key={id}
                        projectId={projectId}
                        proposal={proposal}
                      />
                    )}
                  </>
                )}
              </article>
            ),
          )}
        </div>
      )}
    </details>
  )
}

export function ProposeMeaningFromRun({
  projectId,
  runId,
}: {
  projectId: string
  runId: string
}) {
  const client = useMemo(
    () => createDashboardTRPCClient(projectId),
    [projectId],
  )
  const [open, setOpen] = useState(false)
  const sessionId = authClient.useSession().data?.session.id
  const published = useQuery({
    queryKey: ["meaning-proposal-example", projectId, sessionId, runId],
    queryFn: ({ signal }) =>
      client.businessEvidence.read.query({ kind: "run", runId }, { signal }),
    enabled: open && Boolean(sessionId),
    gcTime: 0,
    refetchInterval: false,
    retry: false,
  })
  return (
    <details
      className="rounded-lg border p-4 text-sm"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium">
        Review meaning of a published result
      </summary>
      {open && published.isPending && (
        <p role="status">Loading published result…</p>
      )}
      {open && published.isError && (
        <p role="alert">Published result unavailable.</p>
      )}
      {open && published.data?.data.kind === "run" && (
        <div className="mt-3 grid gap-3">
          <ProposeMeaning
            projectId={projectId}
            runId={runId}
            fields={published.data.data.fields}
          />
          <MeaningProposals projectId={projectId} />
        </div>
      )}
    </details>
  )
}
