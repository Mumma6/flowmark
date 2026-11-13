"use client"
import { CapturePage } from "../evidence-captures/capture-page"
import { CaptureList } from "../evidence-captures/capture-list"
import { SharedQuestionPage } from "../shared-investigations/shared-question-page"
import { SharedInvestigationList } from "../shared-investigations/shared-list"
import { ShareSavedQuestion } from "../shared-investigations/share-saved-question"
import { Button } from "@flowmark/ui"
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Result } from "effect"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import type { SavedInvestigationSummary } from "@flowmarkdev/core"
import { useTRPCClient } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import { DataState } from "../shared/dashboard-components"
import { useInvestigationOwner } from "./investigation-owner"
import { privateInvestigationKey, savedSelectionHref } from "./saved-selection"

export function InvestigationsPage() {
  const { current } = useProject()
  const userId = useInvestigationOwner()
  const params = useSearchParams()
  const capture = params.get("capture")
  if (capture !== null) {
    return <CapturePage projectId={params.get("project")} id={capture} />
  }
  const shared = params.get("shared")
  if (shared !== null) {
    return <SharedQuestionPage projectId={params.get("project")} id={shared} />
  }
  return (
    <div className="grid min-w-0 gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Your investigations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Private live questions in the selected project. Reopening recomputes
          against retained evidence and your current access. Deleting an entry
          removes only this saved question.
        </p>
      </div>
      {current && userId ? (
        <>
          <CaptureList
            key={`captures:${userId}:${current.id}`}
            projectId={current.id}
          />
          <SharedInvestigationList
            key={`shared:${userId}:${current.id}`}
            projectId={current.id}
          />
          <InvestigationList
            key={`${userId}:${current.id}`}
            userId={userId}
            projectId={current.id}
          />
        </>
      ) : (
        <p role="status">Select a project to see your saved investigations.</p>
      )}
    </div>
  )
}
function InvestigationList({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}) {
  const client = useTRPCClient()
  const [cursors, setCursors] = useState<readonly (string | null)[]>([null])
  const cursor = cursors[cursors.length - 1] ?? undefined
  const key = privateInvestigationKey(userId, projectId)
  const list = useQuery({
    queryKey: [...key, cursor],
    queryFn: userId
      ? ({ signal }) =>
          client.investigations.list.query(
            { projectId, query: { cursor: cursor ?? undefined, limit: 25 } },
            { signal },
          )
      : skipToken,
    retry: false,
    staleTime: 0,
  })
  return (
    <>
      <Button
        variant="outline"
        className="justify-self-start"
        disabled={list.isFetching}
        onClick={() => void list.refetch()}
      >
        Refresh investigations
      </Button>
      <DataState
        pending={list.isPending}
        error={list.error}
        retry={() => void list.refetch()}
      />
      {list.error && cursor && (
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => setCursors([null])}
        >
          Restart saved list
        </Button>
      )}
      {list.data && !list.error && (
        <>
          {list.data.items.length === 0 ? (
            <p role="status" className="text-sm text-muted-foreground">
              No saved investigations on this page. Save a run from its handoff
              panel, a supported period from Explore, or a linked comparison
              from Insights.
            </p>
          ) : (
            <ul className="grid gap-3">
              {list.data.items.map((item) => (
                <InvestigationEntry
                  key={item.id}
                  item={item}
                  userId={userId}
                  projectId={projectId}
                />
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={cursors.length === 1 || list.isFetching}
              onClick={() => setCursors((values) => values.slice(0, -1))}
            >
              Previous saved page
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
              Next saved page
            </Button>
          </div>
        </>
      )}
    </>
  )
}
function InvestigationEntry({
  item,
  userId,
  projectId,
}: {
  item: SavedInvestigationSummary
  userId: string
  projectId: string
}) {
  const client = useTRPCClient()
  const cache = useQueryClient()
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [confirming, setConfirming] = useState(false)
  const reopen = useMutation({
    mutationFn: () =>
      client.investigations.get.query({ projectId, id: item.id }),
  })
  const remove = useMutation({
    mutationFn: () =>
      client.investigations.delete.mutate({ projectId, id: item.id }),
    onSuccess: () => {
      void cache.invalidateQueries({
        queryKey: privateInvestigationKey(userId, projectId),
      })
    },
  })
  const busy = reopen.isPending || remove.isPending
  return (
    <li className="grid min-w-0 gap-3 rounded-lg border border-border p-4">
      <div>
        <p className="break-words text-sm font-medium">{item.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.kind ?? "Unsupported selection"} · Saved {item.createdAt} · Live
          evidence
        </p>
      </div>
      {!item.supported && (
        <p role="status" className="text-sm">
          This saved selection version is unsupported. You can delete it and
          save a supported question.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={busy || !item.supported}
          onClick={() => {
            setMessage("")
            reopen.mutate(undefined, {
              onSuccess: (saved) => {
                if (!saved) {
                  setMessage(
                    "This saved investigation no longer exists. Refresh the list.",
                  )
                  return
                }
                Result.match(savedSelectionHref(projectId, saved.selection), {
                  onFailure: () =>
                    setMessage(
                      "This saved selection is unsupported. Delete it and save a new question.",
                    ),
                  onSuccess: (href) => router.push(href),
                })
              },
            })
          }}
        >
          {reopen.isPending ? "Opening…" : "Open live investigation"}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => setConfirming((value) => !value)}
        >
          Delete saved investigation
        </Button>
      </div>
      {item.supported ? (
        <ShareSavedQuestion projectId={projectId} id={item.id} />
      ) : null}
      {confirming && (
        <div className="grid justify-items-start gap-2">
          <p className="text-sm">
            Delete only “{item.title}”? This cannot be undone; telemetry is
            unaffected.
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => remove.mutate()}
            >
              Confirm delete
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Keep investigation
            </Button>
          </div>
        </div>
      )}
      {(message || reopen.error || remove.error) && (
        <p role="alert" className="text-sm">
          {message || reopen.error?.message || remove.error?.message}
        </p>
      )}
    </li>
  )
}
