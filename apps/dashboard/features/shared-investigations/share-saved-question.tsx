"use client"
import { Button } from "@flowmark/ui"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useTRPCClient } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import { ShareQuestion } from "./share-question"
import { businessSelectionFromSaved } from "./shared-selection"
export function ShareSavedQuestion({
  projectId,
  id,
}: {
  readonly projectId: string
  readonly id: string
}) {
  const client = useTRPCClient(),
    { current } = useProject()
  const [depth, setDepth] = useState<"business" | "diagnostic">("business")
  const load = useMutation({
    mutationFn: () => client.investigations.get.query({ projectId, id }),
  })
  const saved = load.data,
    business = saved?.selection
      ? businessSelectionFromSaved(saved.selection)
      : null
  const selection =
    saved?.selection && depth === "diagnostic" && current?.role !== "business"
      ? {
          version: 1 as const,
          depth: "diagnostic" as const,
          query: saved.selection,
        }
      : business
  return (
    <div className="grid gap-3">
      {!saved ? (
        <Button
          variant="outline"
          className="justify-self-start"
          disabled={load.isPending}
          onClick={() => load.mutate()}
        >
          {load.isPending ? "Loading question…" : "Prepare shared copy"}
        </Button>
      ) : (
        <>
          <label className="grid gap-2 text-sm">
            Maximum evidence depth
            <select
              className="h-10 rounded-md border border-input bg-background px-3"
              value={depth}
              onChange={(event) =>
                setDepth(
                  event.target.value === "diagnostic"
                    ? "diagnostic"
                    : "business",
                )
              }
            >
              <option value="business">Business · published evidence</option>
              {current?.role !== "business" ? (
                <option value="diagnostic">
                  Diagnostic · diagnostic members only
                </option>
              ) : null}
            </select>
          </label>
          {selection ? (
            <ShareQuestion
              key={`${id}:${selection.depth}`}
              projectId={projectId}
              selection={selection}
              initialTitle={saved.title}
            />
          ) : (
            <p role="status" className="text-sm">
              This question cannot be converted to business evidence. Choose
              diagnostic access if available, or open a first-page business
              question.
            </p>
          )}
        </>
      )}
      {load.error ? (
        <p role="alert" className="text-sm">
          {load.error.message}
        </p>
      ) : null}
      {load.isSuccess && !saved ? (
        <p role="status" className="text-sm">
          The private question is no longer available. Refresh the list.
        </p>
      ) : null}
    </div>
  )
}
