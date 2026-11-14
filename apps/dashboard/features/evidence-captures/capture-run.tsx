"use client"
import { Button, Checkbox, Input } from "@flowmark/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { captureHref } from "./capture-presentation"
import { DataState } from "../shared/dashboard-components"
import { authClient } from "../auth/auth-client"
import { useTRPCClient } from "../platform/api-trpc"
export function CaptureRun({
  projectId,
  runId,
}: {
  readonly projectId: string
  readonly runId: string
}) {
  const client = useTRPCClient(),
    identity = authClient.useSession()
  const capabilities = useQuery({
    queryKey: [
      "capture-capabilities",
      identity.data?.user.id,
      identity.data?.session.id,
      projectId,
    ],
    queryFn: ({ signal }) =>
      client.evidenceCaptures.capabilities.query({ projectId }, { signal }),
    enabled: Boolean(identity.data),
    retry: false,
    gcTime: 0,
  })
  if (capabilities.error) {
    return (
      <DataState
        pending={false}
        error={capabilities.error}
        retry={() => void capabilities.refetch()}
      />
    )
  }
  if (!capabilities.data?.enabled || !capabilities.data.canCreate) {
    return null
  }
  return (
    <CaptureRunForm
      key={`${identity.data?.user.id}:${identity.data?.session.id}:${projectId}:${runId}`}
      projectId={projectId}
      runId={runId}
    />
  )
}
function CaptureRunForm({
  projectId,
  runId,
}: {
  readonly projectId: string
  readonly runId: string
}) {
  const client = useTRPCClient(),
    cache = useQueryClient()
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState("Run evidence"),
    [confirmed, setConfirmed] = useState(false)
  const create = useMutation({
    mutationFn: () =>
      client.evidenceCaptures.create.mutate({
        projectId,
        command: { runId, title },
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["evidence-captures"] })
    },
  })
  return (
    <section
      className="grid min-w-0 gap-3 rounded-lg border border-border p-4"
      aria-label="Capture business evidence"
    >
      <Button
        variant="outline"
        className="justify-self-start"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close capture" : "Capture published evidence"}
      </Button>
      {open ? (
        <>
          <p className="text-sm text-muted-foreground">
            Save this run's published results and references for permitted
            project members. This observation expires within 24 hours, or
            earlier with source expiry or access changes. Maximum 64 KiB; raw
            diagnostics are omitted.
          </p>
          {create.data ? (
            <>
              <p role="status">Evidence captured.</p>
              <a
                className="underline"
                href={captureHref(projectId, create.data.id)}
              >
                Inspect captured evidence
              </a>
            </>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (confirmed && !create.isPending) {
                  create.mutate()
                }
              }}
            >
              <label className="grid gap-2 text-sm">
                Capture name
                <Input
                  value={title}
                  maxLength={120}
                  required
                  disabled={create.isPending}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={confirmed}
                  disabled={create.isPending}
                  onCheckedChange={(value) => setConfirmed(value === true)}
                />
                <span>
                  I intend to save this title and published evidence for
                  permitted project members.
                </span>
              </label>
              <Button
                type="submit"
                className="justify-self-start"
                disabled={!confirmed || !title.trim() || create.isPending}
              >
                {create.isPending ? "Capturing…" : "Create capture"}
              </Button>
            </form>
          )}
          {create.error ? <p role="alert">{create.error.message}</p> : null}
        </>
      ) : null}
    </section>
  )
}
