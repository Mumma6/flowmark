"use client"
import { Button, Input } from "@flowmark/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Result } from "effect"
import { useState } from "react"
import type { SavedSelection } from "@flowmarkdev/core"
import { useTRPCClient } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import { ViewLink } from "../shared/dashboard-components"
import { useInvestigationOwner } from "./investigation-owner"
import {
  decodeSavedSelection,
  privateInvestigationKey,
  savedSelectionTitle,
} from "./saved-selection"
export function SaveInvestigation({
  selection,
}: {
  selection: SavedSelection
}) {
  const owner = useInvestigationOwner()
  const { current } = useProject()
  const parsed = decodeSavedSelection(selection)
  return owner &&
    current?.id.toLowerCase() === selection.projectId.toLowerCase() &&
    Result.isSuccess(parsed) ? (
    <SaveForm
      key={`${owner}:${current.id}:${JSON.stringify(parsed.success)}`}
      userId={owner}
      selection={parsed.success}
    />
  ) : null
}
function SaveForm({
  userId,
  selection,
}: {
  userId: string
  selection: SavedSelection
}) {
  const client = useTRPCClient()
  const cache = useQueryClient()
  const [title, setTitle] = useState(() => savedSelectionTitle(selection))
  const save = useMutation({
    mutationFn: () =>
      client.investigations.save.mutate({
        projectId: selection.projectId,
        command: { title, selection },
      }),
    onSuccess: () => {
      void cache.invalidateQueries({
        queryKey: privateInvestigationKey(userId, selection.projectId),
      })
    },
  })
  return (
    <section
      aria-label="Save private investigation"
      className="grid gap-3 rounded-lg border border-border p-4"
    >
      <p className="text-sm font-medium">Save this live investigation</p>
      <p className="text-xs text-muted-foreground">
        Private to your account in this project. Reopening reads current
        evidence; it stores no telemetry or access rights.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <label className="grid min-w-0 flex-1 gap-2 text-sm">
          Investigation name
          <Input
            maxLength={120}
            value={title}
            disabled={save.isPending}
            onChange={(event) => {
              setTitle(event.target.value)
              save.reset()
            }}
          />
        </label>
        <Button
          type="submit"
          disabled={save.isPending || !title.trim() || save.isSuccess}
        >
          {save.isPending ? "Saving…" : "Save investigation"}
        </Button>
      </form>
      {save.error && (
        <p role="alert" className="text-sm">
          Could not save: {save.error.message}. Your selection is preserved;
          retry when available.
        </p>
      )}
      {save.data && (
        <p role="status" className="text-sm">
          Saved privately.{" "}
          <ViewLink href="/investigations">Open investigations</ViewLink>
        </p>
      )}
    </section>
  )
}
