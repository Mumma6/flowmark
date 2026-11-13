"use client"
import { PurgeExpiredCaptures } from "./purge-expired-captures"
import { Button } from "@flowmark/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import type { EvidenceCaptureSummary } from "@flowmarkdev/core"
import { authClient } from "../auth/auth-client"
import { useTRPCClient } from "../platform/api-trpc"
import { DataState } from "../shared/dashboard-components"
import { captureUnavailableReason, captureHref } from "./capture-presentation"
export function CaptureList({ projectId }: { readonly projectId: string }) {
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
  if (!capabilities.data?.enabled) {
    return null
  }
  return (
    <EnabledCaptures
      key={`${identity.data?.session.id}:${projectId}`}
      projectId={projectId}
      canPurge={capabilities.data.canPurge}
    />
  )
}
function EnabledCaptures({
  projectId,
  canPurge,
}: {
  readonly projectId: string
  readonly canPurge: boolean
}) {
  const client = useTRPCClient(),
    identity = authClient.useSession()
  const [cursors, setCursors] = useState<readonly (string | null)[]>([null])
  const cursor = cursors[cursors.length - 1] ?? undefined
  const list = useQuery({
    queryKey: [
      "evidence-captures",
      identity.data?.user.id,
      identity.data?.session.id,
      projectId,
      cursor,
    ],
    queryFn: ({ signal }) =>
      client.evidenceCaptures.list.query(
        { projectId, query: { cursor, limit: 25 } },
        { signal },
      ),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  })
  return (
    <section className="grid min-w-0 gap-3" aria-label="Captured evidence">
      <h2 className="text-xl font-semibold">Captured evidence</h2>
      <p className="text-sm text-muted-foreground">
        Saved observations expire within 24 hours and depend on current access
        and source availability.
      </p>
      {canPurge ? <PurgeExpiredCaptures projectId={projectId} /> : null}
      <Button
        variant="outline"
        className="justify-self-start"
        disabled={list.isFetching}
        onClick={() => void list.refetch()}
      >
        Refresh captures
      </Button>
      <DataState
        pending={list.isPending}
        error={list.error}
        retry={() => void list.refetch()}
      />
      {list.error && cursor ? (
        <Button variant="outline" onClick={() => setCursors([null])}>
          Restart capture list
        </Button>
      ) : null}
      {list.data && !list.error ? (
        <>
          <ul className="grid gap-3">
            {list.data.items.map((item) => (
              <CaptureEntry key={item.id} projectId={projectId} item={item} />
            ))}
          </ul>
          {list.data.items.length === 0 ? (
            <p role="status">
              No captures on this page. Capture a run from its business evidence
              view.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={cursors.length === 1 || list.isFetching}
              onClick={() => setCursors((values) => values.slice(0, -1))}
            >
              Previous capture page
            </Button>
            <Button
              variant="outline"
              disabled={!list.data.nextCursor || list.isFetching}
              onClick={() => {
                const next = list.data?.nextCursor
                if (next) {
                  setCursors((values) => [...values, next])
                }
              }}
            >
              Next capture page
            </Button>
          </div>
        </>
      ) : null}
    </section>
  )
}
function CaptureEntry({
  projectId,
  item,
}: {
  readonly projectId: string
  readonly item: EvidenceCaptureSummary
}) {
  const client = useTRPCClient(),
    cache = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const remove = useMutation({
    mutationFn: () =>
      client.evidenceCaptures.delete.mutate({ projectId, id: item.id }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["evidence-captures"] })
    },
  })
  return (
    <li className="grid min-w-0 gap-2 rounded-lg border border-border p-4">
      <p className="break-words font-medium">
        {item.title ?? "Unavailable capture"}
      </p>
      <p className="text-xs text-muted-foreground">
        Captured {item.capturedAt}
        {item.expiresAt
          ? ` · Expires ${item.expiresAt}`
          : ` · ${item.reason ? captureUnavailableReason(item.reason) : "No longer permitted"}`}
      </p>
      {item.available ? (
        <a className="underline" href={captureHref(projectId, item.id)}>
          Inspect capture
        </a>
      ) : null}
      {item.canDelete ? (
        <Button
          variant="ghost"
          className="justify-self-start"
          disabled={remove.isPending}
          onClick={() => setConfirm((value) => !value)}
        >
          Delete capture
        </Button>
      ) : null}
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm">
            Delete this capture permanently? Source evidence is unaffected.
          </p>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Confirm delete capture
          </Button>
          <Button
            variant="outline"
            disabled={remove.isPending}
            onClick={() => setConfirm(false)}
          >
            Keep capture
          </Button>
        </div>
      ) : null}
      {remove.error ? <p role="alert">{remove.error.message}</p> : null}
    </li>
  )
}
