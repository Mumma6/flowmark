"use client"
import { Button } from "@flowmark/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import type { SharedInvestigationSummary } from "@flowmarkdev/core"
import { useTRPCClient } from "../platform/api-trpc"
import { authClient } from "../auth/auth-client"
import { DataState } from "../shared/dashboard-components"
import { sharedQuestionHref } from "./shared-selection"
export function SharedInvestigationList({
  projectId,
}: {
  readonly projectId: string
}) {
  const client = useTRPCClient(),
    identity = authClient.useSession()
  const [cursors, setCursors] = useState<readonly string[]>([])
  const scope = [
    "shared-investigations",
    identity.data?.user.id,
    identity.data?.session.id,
    projectId,
  ] as const
  const list = useQuery({
    queryKey: [...scope, cursors.at(-1)],
    queryFn: ({ signal }) =>
      client.sharedInvestigations.list.query(
        { projectId, query: { cursor: cursors.at(-1), limit: 25 } },
        { signal },
      ),
    enabled: Boolean(identity.data),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  })
  return (
    <section className="grid gap-4" aria-label="Project shared investigations">
      <h2 className="text-xl font-semibold">Shared with this project</h2>
      <p className="text-sm text-muted-foreground">
        Live questions, not saved results. Each open checks current membership
        and evidence permissions.
      </p>
      <Button
        variant="outline"
        className="justify-self-start"
        disabled={list.isFetching}
        onClick={() => void list.refetch()}
      >
        Refresh shared questions
      </Button>
      <DataState
        pending={list.isPending}
        error={list.error}
        retry={() => void list.refetch()}
      />
      {list.error && cursors.length ? (
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => setCursors([])}
        >
          Restart shared list
        </Button>
      ) : null}
      {list.data && !list.error ? (
        <>
          {list.data.items.length === 0 ? (
            <p className="text-sm">
              No shared questions are available on this page.
            </p>
          ) : (
            <ul className="grid gap-3">
              {list.data.items.map((item) => (
                <SharedEntry key={item.id} projectId={projectId} item={item} />
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={!cursors.length || list.isFetching}
              onClick={() => setCursors((values) => values.slice(0, -1))}
            >
              Previous shared page
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
              Next shared page
            </Button>
          </div>
        </>
      ) : null}
    </section>
  )
}
function SharedEntry({
  projectId,
  item,
}: {
  readonly projectId: string
  readonly item: SharedInvestigationSummary
}) {
  const client = useTRPCClient(),
    cache = useQueryClient(),
    [confirming, setConfirming] = useState(false)
  const revoke = useMutation({
    mutationFn: () =>
      client.sharedInvestigations.revoke.mutate({ projectId, id: item.id }),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["shared-investigations"] }),
  })
  return (
    <li className="grid min-w-0 gap-3 rounded-lg border border-border p-4">
      <p className="break-words font-medium">
        {item.available ? item.title : "Unavailable shared question"}
      </p>
      <p className="text-xs text-muted-foreground">
        {item.available
          ? `${item.depth} · Live question`
          : "This question's selection is no longer available. Only its cleanup reference is shown."}{" "}
        · Shared {item.createdAt}
      </p>
      <div className="flex flex-wrap gap-3">
        {item.available ? (
          <Button asChild variant="outline">
            <a href={sharedQuestionHref(projectId, item.id)}>
              Open shared question
            </a>
          </Button>
        ) : null}
        {item.canRevoke ? (
          <Button
            variant="ghost"
            disabled={revoke.isPending}
            onClick={() => setConfirming((value) => !value)}
          >
            Revoke shared copy
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <div className="grid justify-items-start gap-3">
          <p className="text-sm">
            Remove only this shared copy? Its link will stop working. Source
            evidence and private originals stay intact.
          </p>
          <Button
            variant="destructive"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate()}
          >
            {revoke.isPending ? "Revoking…" : "Confirm revoke"}
          </Button>
          <Button variant="outline" onClick={() => setConfirming(false)}>
            Keep shared copy
          </Button>
        </div>
      ) : null}
      {revoke.error ? (
        <p role="alert" className="text-sm">
          {revoke.error.message}
        </p>
      ) : null}
    </li>
  )
}
