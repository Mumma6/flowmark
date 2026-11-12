"use client"

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@flowmark/ui"
import { Array, pipe } from "effect"
import { useState, type FormEvent } from "react"
import { useProject } from "../../projects/project-context"
import { useDataErasure } from "./use-data-erasure"

function ProjectErasure({
  projectId,
  projectName,
}: {
  readonly projectId: string
  readonly projectName: string
}) {
  const {
    current,
    preview,
    confirm,
    cancel,
    confirmationError,
    resume,
    status,
    running,
    pause,
    continue: continueCleanup,
  } = useDataErasure(projectId)
  const [kind, setKind] = useState("workflow")
  const [workflow, setWorkflow] = useState("")
  const [after, setAfter] = useState("")
  const [before, setBefore] = useState("")
  const [runIds, setRunIds] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [password, setPassword] = useState("")
  const [understood, setUnderstood] = useState(false)
  const [reviewing, setReviewing] = useState(true)
  const error =
    preview.error ??
    confirmationError ??
    resume.error ??
    cancel.error ??
    status.error
  const scopeLabel =
    current?.scope.kind === "project" ? "Delete project" : "Erase telemetry"
  const submitPreview = (event: FormEvent) => {
    event.preventDefault()
    const scope =
      kind === "project"
        ? { kind: "project" as const }
        : kind === "runs"
          ? {
              kind: "runs" as const,
              runIds: pipe(
                runIds.split(/[\s,]+/),
                Array.filter((id) => id.length > 0),
                Array.dedupe,
              ),
            }
          : {
              kind: "workflow" as const,
              workflow,
              after: `${after}:00Z`,
              before: `${before}:00Z`,
            }
    setConfirmation("")
    setPassword("")
    setUnderstood(false)
    setReviewing(true)
    preview.mutate({ projectId, scope })
  }
  if (status.isPending) {
    return <p role="status">Loading cleanup status…</p>
  }
  return (
    <div className="grid gap-5">
      <p className="text-sm leading-6 text-muted-foreground">
        Selected project:{" "}
        <strong className="text-foreground">{projectName}</strong>. Erasure is
        permanent. Export downloads are not available yet; preserve any evidence
        you need before continuing. Backups and provider records expire
        separately.
      </p>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {current?.state === "purging" ? (
        <section className="grid gap-4" aria-labelledby="cleanup-progress">
          <h3 id="cleanup-progress" className="font-medium">
            Cleanup in progress
          </h3>
          <p role="status" aria-live="polite" className="text-sm">
            Removed {current.deletedRuns} of {current.counts.runs} runs and{" "}
            {current.deletedEvents} of {current.counts.events} events. Other
            cleanup phases may still be pending.
          </p>
          <p className="text-sm text-muted-foreground">
            Project reads and writes are blocked. Existing keys are invalid.
            Closing this page pauses cleanup after the current batch; return
            here to resume. Cleanup cannot be cancelled after confirmation.
          </p>
          {current.failureCode ? (
            <p className="text-sm text-destructive">
              The previous batch failed. Committed progress is safe; retry to
              continue.
            </p>
          ) : null}
          <div>
            {running ? (
              <Button variant="outline" onClick={pause}>
                Pause after this batch
              </Button>
            ) : (
              <Button onClick={continueCleanup} disabled={resume.isPending}>
                Resume cleanup
              </Button>
            )}
          </div>
        </section>
      ) : current?.state === "live_data_deleted" && reviewing ? (
        <section className="grid gap-3" role="status">
          <h3 className="font-medium">Live data deleted</h3>
          <p className="text-sm">
            {current.scope.kind === "project"
              ? "The project and its owned data have been deleted. Create or select another project to continue."
              : "The selected complete runs have been erased. Create replacement ingestion keys under API keys before reporting new work. Retained runs can continue with fresh keys."}
          </p>
          <p className="text-sm text-muted-foreground">
            This does not claim immediate deletion of provider logs, delivered
            email or backups.
          </p>
          {current.scope.kind !== "project" ? (
            <Button variant="outline" onClick={() => setReviewing(false)}>
              Review another erasure
            </Button>
          ) : null}
        </section>
      ) : (
        <>
          <form className="grid max-w-xl gap-4" onSubmit={submitPreview}>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Operation</span>
              <NativeSelect
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <NativeSelectOption value="workflow">
                  Erase a workflow’s complete runs in a period
                </NativeSelectOption>
                <NativeSelectOption value="runs">
                  Erase specific complete runs
                </NativeSelectOption>
                <NativeSelectOption value="project">
                  Permanently delete this project
                </NativeSelectOption>
              </NativeSelect>
            </label>
            {kind === "workflow" ? (
              <>
                <label className="grid gap-2 text-sm">
                  <span>Exact workflow name</span>
                  <Input
                    required
                    maxLength={200}
                    value={workflow}
                    onChange={(event) => setWorkflow(event.target.value)}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span>Run start from (UTC, inclusive)</span>
                    <Input
                      required
                      type="datetime-local"
                      value={after}
                      onChange={(event) => setAfter(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span>Run start until (UTC, exclusive)</span>
                    <Input
                      required
                      type="datetime-local"
                      value={before}
                      onChange={(event) => setBefore(event.target.value)}
                    />
                  </label>
                </div>
              </>
            ) : kind === "runs" ? (
              <label className="grid gap-2 text-sm">
                <span>Internal run IDs (up to 100, separated by commas)</span>
                <Input
                  required
                  value={runIds}
                  onChange={(event) => setRunIds(event.target.value)}
                />
              </label>
            ) : (
              <p className="text-sm">
                Deletes all project telemetry, configuration, keys, private
                selections and project membership.
              </p>
            )}
            <div>
              <Button
                variant="outline"
                disabled={preview.isPending}
                type="submit"
              >
                {preview.isPending ? "Counting data…" : "Preview scope"}
              </Button>
            </div>
          </form>
          {current?.state === "previewed" && reviewing ? (
            <section
              className="grid gap-4 rounded-lg border border-destructive/40 p-4"
              aria-labelledby="erasure-review"
            >
              <h3 id="erasure-review" className="font-medium">
                {scopeLabel}: {current.projectName}
              </h3>
              <p className="text-sm">
                {current.counts.runs} complete runs · {current.counts.events}{" "}
                events · {current.counts.apiKeys} API keys ·{" "}
                {current.counts.browserKeys} browser keys
                {current.scope.kind === "project"
                  ? ` · ${current.counts.configurations} configuration records`
                  : ""}
              </p>
              {current.scope.kind === "workflow" ? (
                <p className="break-words text-sm">
                  Workflow: {current.scope.workflow}. Run starts from{" "}
                  {current.scope.after} until {current.scope.before}. Runs
                  created after this preview are excluded.
                </p>
              ) : current.scope.kind === "runs" ? (
                <p className="break-all text-sm">
                  Run IDs: {current.scope.runIds.join(", ")}
                </p>
              ) : null}
              <Alert variant="destructive">
                <AlertDescription>
                  All current project keys will stop working immediately. The
                  project will be unavailable during cleanup.{" "}
                  {current.scope.kind !== "project"
                    ? "Afterward, new run starts must be later than confirmation and the latest erased run start. Older buffered or historical starts will be rejected across this project. Future-dated clocks can delay new starts."
                    : "Project deletion cannot be undone."}
                </AlertDescription>
              </Alert>
              {current.counts.latestStart ? (
                <p className="text-sm text-muted-foreground">
                  Latest selected run start: {current.counts.latestStart}
                </p>
              ) : null}
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  const submittedPassword = password
                  setPassword("")
                  confirm.mutate({
                    projectId,
                    operationId: current.id,
                    confirmation,
                    password: submittedPassword,
                  })
                }}
              >
                <label className="grid gap-2 text-sm">
                  <span>
                    Type the project name:{" "}
                    <strong>{current.projectName}</strong>
                  </span>
                  <Input
                    required
                    autoComplete="off"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Current password</span>
                  <Input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={understood}
                    onCheckedChange={setUnderstood}
                  />
                  <span>
                    I reviewed the exact scope and understand the permanent
                    deletion and key invalidation.
                  </span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    type="submit"
                    disabled={
                      !understood ||
                      password.length === 0 ||
                      confirmation !== current.projectName ||
                      confirm.isPending
                    }
                  >
                    {confirm.isPending ? "Confirming…" : scopeLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReviewing(false)
                      setPassword("")
                      cancel.mutate({ projectId, operationId: current.id })
                    }}
                  >
                    Cancel preview
                  </Button>
                </div>
              </form>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

export function DataPrivacyPanel() {
  const { current } = useProject()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data &amp; privacy</CardTitle>
        <CardDescription>
          Review and erase complete telemetry or delete a solely owned project.
          Shared projects require an ownership policy before deletion is
          available.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {current ? (
          <ProjectErasure
            key={current.id}
            projectId={current.id}
            projectName={current.name}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No project selected. Create or select a project under Projects. Your
            account is still available.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
