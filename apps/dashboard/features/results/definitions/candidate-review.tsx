"use client"

import { useQuery } from "@tanstack/react-query"
import { Button, Input, Textarea } from "@flowmark/ui"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { createDashboardTRPCClient } from "../../platform/api-browser-client"
import { runInvestigationPath } from "../../runs/investigation/investigation-navigation"
import { CopyButton } from "../../shared/dashboard-components"
import { candidateSupport } from "./candidate-review-model"

type Candidate = {
  name: string
  question: string
  workflow: string
  claimedWorkflow: string
  locator: string
  revision: string
  unknowns: string
}

const bounds = {
  name: 100,
  question: 300,
  workflow: 200,
  claimedWorkflow: 200,
  locator: 300,
  revision: 100,
  unknowns: 400,
}

export function CandidateEvidence({
  projectId,
  client,
  candidate,
  accepted,
  onAccept,
  onDismiss,
  onEdit,
}: {
  projectId: string
  client: ReturnType<typeof createDashboardTRPCClient>
  candidate: Candidate
  accepted: boolean
  onAccept: () => void
  onDismiss: () => void
  onEdit: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  const evidence = useQuery({
    queryKey: ["candidate-run-evidence", projectId, candidate.workflow],
    queryFn: ({ signal }) =>
      client.run.list.query(
        { workflow: candidate.workflow, limit: 1 },
        { signal },
      ),
    enabled: Boolean(candidate.workflow),
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  })
  const returned = evidence.isSuccess ? evidence.data.runs[0] : undefined
  const run = returned?.workflow === candidate.workflow ? returned : undefined
  return (
    <section aria-label="Candidate review" className="grid gap-4">
      <div>
        <h4
          ref={heading}
          tabIndex={-1}
          className="break-words text-base font-medium"
        >
          {candidate.name}
        </h4>
        {candidate.question && candidate.question !== candidate.name && (
          <p className="break-words text-muted-foreground">
            {candidate.question}
          </p>
        )}
      </div>
      <p role="status" className="font-medium">
        {candidateSupport(
          candidate.claimedWorkflow || undefined,
          run?.workflow,
        )}
        {accepted && " · Accepted for this review"}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-md border p-3">
          <h5 className="font-medium">Source inference</h5>
          {candidate.claimedWorkflow ? (
            <>
              <p className="break-words">{candidate.claimedWorkflow}</p>
              <p className="break-words text-muted-foreground">
                {candidate.locator} · {candidate.revision}
              </p>
              <p className="text-muted-foreground">
                Supplied by the reviewer. Repository context stays in this tab.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              No source inference supplied.
            </p>
          )}
        </div>
        <div className="min-w-0 rounded-md border p-3">
          <h5 className="font-medium">Recorded evidence</h5>
          {candidate.workflow && (
            <p className="break-words">{candidate.workflow}</p>
          )}
          {candidate.workflow && evidence.isPending && (
            <p role="status">Checking the selected workflow…</p>
          )}
          {candidate.workflow && evidence.isError && (
            <p role="alert">
              The recorded evidence could not be checked.{" "}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void evidence.refetch()}
              >
                Retry evidence check
              </Button>
            </p>
          )}
          {candidate.workflow && evidence.isSuccess && !run && (
            <p>No run was returned for this exact workflow.</p>
          )}
          {!candidate.workflow && (
            <p className="text-muted-foreground">
              No workflow selected for a recorded evidence check.
            </p>
          )}
          {run && (
            <Button asChild type="button" size="sm" variant="ghost">
              <a
                href={runInvestigationPath(run.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Inspect one recorded run (new tab)
              </a>
            </Button>
          )}
        </div>
      </div>
      {candidate.unknowns && (
        <p className="break-words text-muted-foreground">
          Open question · {candidate.unknowns}
        </p>
      )}
      <p className="text-muted-foreground">
        A recorded run supports the workflow name. Process membership and
        business meaning still need review.
      </p>
      <div className="flex flex-wrap gap-2">
        {!accepted && (
          <Button
            type="button"
            onClick={onAccept}
            disabled={Boolean(candidate.workflow) && evidence.isPending}
          >
            Accept candidate locally
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onEdit}>
          Edit or rename
        </Button>
        <Button type="button" variant="ghost" onClick={onDismiss}>
          Dismiss candidate
        </Button>
      </div>
      {accepted && (
        <p className="text-muted-foreground">
          To save process metadata, use the separate import below.{" "}
          {run && (
            <CopyButton
              label="Copy recorded workflow name"
              value={run.workflow}
            />
          )}
        </p>
      )}
    </section>
  )
}

export function CandidateReview({
  projectId,
  workflow,
  initiallyOpen = false,
}: {
  projectId: string
  workflow?: string
  initiallyOpen?: boolean
}) {
  const [draft, setDraft] = useState<Candidate>({
    name: "",
    question: "",
    workflow: workflow ?? "",
    claimedWorkflow: "",
    locator: "",
    revision: "",
    unknowns: "",
  })
  const [review, setReview] = useState<Candidate | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(initiallyOpen)
  const suggestedNames = useId()
  const draftName = useRef<HTMLInputElement>(null)
  const dismissedStatus = useRef<HTMLParagraphElement>(null)
  const focusDraft = useRef(false)
  useEffect(() => {
    if (dismissed) {
      dismissedStatus.current?.focus()
    }
    if (!review && focusDraft.current) {
      draftName.current?.focus()
      focusDraft.current = false
    }
  }, [dismissed, review])
  const client = useMemo(
    () => createDashboardTRPCClient(projectId),
    [projectId],
  )
  const discovery = useQuery({
    queryKey: ["candidate-workflow-names", projectId],
    queryFn: ({ signal }) =>
      client.workflow.discover.query({ limit: 25 }, { signal }),
    enabled: open && !review,
    refetchInterval: false,
    retry: false,
  })

  const input = (field: keyof Candidate) => ({
    value: draft[field],
    maxLength: bounds[field],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setDraft({ ...draft, [field]: event.target.value }),
  })
  const hasSource = Boolean(
    draft.claimedWorkflow.trim() ||
    draft.locator.trim() ||
    draft.revision.trim(),
  )
  const candidateName = draft.name.trim() || draft.question.trim()
  const canReview =
    Boolean(candidateName) &&
    (!hasSource ||
      Boolean(
        draft.claimedWorkflow.trim() &&
        draft.locator.trim() &&
        draft.revision.trim(),
      ))

  return (
    <details
      id="process-candidate"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="scroll-mt-4 rounded-lg border p-4 text-sm"
    >
      <summary className="cursor-pointer font-medium">
        Review a process candidate
      </summary>
      <div className="mt-4 grid gap-4">
        {dismissed ? (
          <div className="flex flex-wrap items-center gap-2">
            <p ref={dismissedStatus} tabIndex={-1} role="status">
              Candidate dismissed in this tab.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDismissed(false)}
            >
              Restore candidate
            </Button>
          </div>
        ) : review ? (
          <CandidateEvidence
            projectId={projectId}
            client={client}
            candidate={review}
            accepted={accepted}
            onAccept={() => setAccepted(true)}
            onEdit={() => {
              focusDraft.current = true
              setReview(null)
            }}
            onDismiss={() => setDismissed(true)}
          />
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!canReview) {
                return
              }
              setAccepted(false)
              setReview({
                ...draft,
                name: candidateName,
                question: draft.question.trim(),
                workflow: draft.workflow.trim(),
                claimedWorkflow: draft.claimedWorkflow.trim(),
                locator: draft.locator.trim(),
                revision: draft.revision.trim(),
              })
            }}
          >
            <p className="text-muted-foreground">
              Start with an observed workflow, a question or a suggestion from
              your local coding agent.
            </p>
            <label className="grid gap-1.5">
              Candidate name
              <Input
                {...input("name")}
                ref={draftName}
                placeholder="Invoice processing"
              />
            </label>
            <label className="grid gap-1.5">
              Question{" "}
              <Input
                {...input("question")}
                placeholder="Where does invoice processing start?"
              />
            </label>
            <label className="grid gap-1.5">
              Exact workflow to check
              <Input
                {...input("workflow")}
                list={suggestedNames}
                placeholder="invoice.import"
              />
              <span className="text-muted-foreground">
                Studio looks for one recorded run under this exact name.
              </span>
            </label>
            <datalist id={suggestedNames}>
              {discovery.data?.workflows.map(({ name }) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {discovery.isError && (
              <p className="text-muted-foreground" role="status">
                Workflow suggestions are unavailable. You can enter the exact
                name directly.
              </p>
            )}
            <details className="grid gap-3">
              <summary className="cursor-pointer">
                Add local source context
              </summary>
              <div className="mt-3 grid gap-3">
                <div>
                  <CopyButton
                    label="Copy shortlist question"
                    value="In this local repository, suggest up to three processes to observe. For each, give a proposed workflow name, a file and line, the source revision, and what remains unknown. Ground the suggestions in executable code and treat comments as context. Return a shortlist for my review."
                  />
                </div>
                <p className="text-muted-foreground">
                  Use your local shortlist. Enter a proposed workflow, a file
                  and line, and the source revision together. These fields stay
                  in this tab.
                </p>
                <label className="grid gap-1.5">
                  Proposed workflow
                  <Input
                    {...input("claimedWorkflow")}
                    placeholder="invoice.import"
                  />
                </label>
                <label className="grid gap-1.5">
                  Source locator
                  <Input
                    {...input("locator")}
                    placeholder="src/jobs/invoice.ts:24"
                  />
                </label>
                <label className="grid gap-1.5">
                  Source revision
                  <Input
                    {...input("revision")}
                    placeholder="Commit or revision"
                  />
                </label>
              </div>
            </details>
            <label className="grid gap-1.5">
              What remains unknown?
              <Textarea {...input("unknowns")} rows={2} />
            </label>
            <Button
              type="submit"
              disabled={!canReview}
              className="justify-self-start"
            >
              Review candidate
            </Button>
          </form>
        )}
      </div>
    </details>
  )
}
