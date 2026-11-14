"use client"
import { ExportEvidence } from "../investigations/export-evidence"
import { Button } from "@flowmark/ui"
import { useQuery } from "@tanstack/react-query"
import { Schema } from "effect"
import { authClient } from "../auth/auth-client"
import { useProject } from "../projects/project-context"
import { useTRPCClient } from "../platform/api-trpc"
import { DataState } from "../shared/dashboard-components"
import { captureUnavailableReason } from "./capture-presentation"
import { BusinessRunView } from "@flowmark/ui/business-run"
const Id = Schema.String.check(Schema.isGUID())
export function CapturePage({
  projectId,
  id,
}: {
  readonly projectId: string | null
  readonly id: string
}) {
  const { current, projects, select, pending, error, retry } = useProject()
  if (!projectId || !Schema.is(Id)(projectId) || !Schema.is(Id)(id)) {
    return <p role="alert">This capture link is invalid.</p>
  }
  if (pending || error) {
    return <DataState pending={pending} error={error} retry={retry} />
  }
  if (current?.id !== projectId) {
    return (
      <section className="grid justify-items-start gap-3">
        <h1 className="text-xl font-semibold">Open captured evidence</h1>
        <p className="text-sm">
          Select the link's project before loading its capture. The link grants
          no project access.
        </p>
        {projects.some((project) => project.id === projectId) ? (
          <Button onClick={() => select(projectId)}>
            Select capture's project
          </Button>
        ) : (
          <p role="alert">
            This project is unavailable to your account. Sign in with an account
            that already has access.
          </p>
        )}
      </section>
    )
  }
  return (
    <AuthorizedCapture
      key={`${projectId}:${id}`}
      projectId={projectId}
      id={id}
    />
  )
}
function AuthorizedCapture({
  projectId,
  id,
}: {
  readonly projectId: string
  readonly id: string
}) {
  const client = useTRPCClient(),
    identity = authClient.useSession()
  const capture = useQuery({
    queryKey: [
      "captured-evidence",
      identity.data?.user.id,
      identity.data?.session.id,
      projectId,
      id,
    ],
    queryFn: ({ signal }) =>
      client.evidenceCaptures.get.query({ projectId, id }, { signal }),
    enabled: Boolean(identity.data),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30000,
  })
  if (capture.error) {
    return (
      <section className="grid justify-items-start gap-3">
        <DataState
          pending={false}
          error={capture.error}
          retry={() => void capture.refetch()}
        />
        <a className="underline" href="/investigations">
          Back to investigations
        </a>
      </section>
    )
  }
  if (!capture.data) {
    return <p role="status">Checking capture access…</p>
  }
  if (!capture.data.available) {
    return (
      <section className="grid gap-3">
        <h1 className="text-xl font-semibold">Capture unavailable</h1>
        <p>
          Captured {capture.data.capturedAt} ·{" "}
          {captureUnavailableReason(capture.data.reason)}. Its previous title
          and evidence are withheld.
        </p>
        <a className="underline" href="/investigations">
          Manage captures
        </a>
      </section>
    )
  }
  const value = capture.data.capture,
    data = value.evidence.data
  return (
    <section className="grid min-w-0 gap-4">
      <div>
        <h1 className="break-words text-2xl font-semibold">{value.title}</h1>
        <p className="mt-2 text-sm font-medium">
          Captured observation · This is not live evidence.
        </p>
        <p className="text-sm text-muted-foreground">
          Captured {value.capturedAt} · Expires {value.expiresAt}
        </p>
        <p className="text-sm text-muted-foreground">
          {value.coverage} Application-reported results are not verified
          correctness.
        </p>
      </div>
      <BusinessRunView
        summary={data.summary}
        fields={data.fields}
        references={data.references}
        revision={value.evidence.projection.publicationRevision}
        observedAt={value.evidence.projection.observedAt}
      />
      <ExportEvidence
        captured
        load={() => client.evidenceCaptures.export.query({ projectId, id })}
      />
      <p className="text-sm">
        For current evidence, open the source separately. Your permissions will
        be checked again.
      </p>
      <a
        className="justify-self-start underline"
        href={`/?businessSelection=${encodeURIComponent(JSON.stringify({ kind: "run", runId: value.sourceRunId }))}`}
      >
        Open live source
      </a>
      <Button
        variant="outline"
        className="justify-self-start"
        disabled={capture.isFetching}
        onClick={() => void capture.refetch()}
      >
        Recheck capture access
      </Button>
      <a className="underline" href="/investigations">
        Back to investigations
      </a>
    </section>
  )
}
