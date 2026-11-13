"use client"
import { Alert, AlertDescription, Button, Checkbox, Input } from "@flowmark/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import type { SharedInvestigationSelection } from "@flowmarkdev/core"
import { useTRPCClient } from "../platform/api-trpc"
import { sharedQuestionHref } from "./shared-selection"
export function ShareQuestion({
  projectId,
  selection,
  initialTitle,
}: {
  readonly projectId: string
  readonly selection: SharedInvestigationSelection
  readonly initialTitle: string
}) {
  const client = useTRPCClient(),
    cache = useQueryClient()
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(initialTitle.slice(0, 120)),
    [confirmed, setConfirmed] = useState(false),
    [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const share = useMutation({
    mutationFn: () =>
      client.sharedInvestigations.create.mutate({
        projectId,
        command: { title, selection },
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["shared-investigations"] })
    },
  })
  const href = share.data ? sharedQuestionHref(projectId, share.data.id) : null
  return (
    <section
      className="grid min-w-0 gap-3 rounded-lg border border-border p-4"
      aria-label="Share live question"
    >
      <Button
        variant="outline"
        className="justify-self-start"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close sharing" : "Share live question"}
      </Button>
      {open ? (
        <>
          <p className="text-sm text-muted-foreground">
            Create an immutable shared copy for current and future project
            members with {selection.depth} access. It stores this question, not
            its results. Recipients use their own current permissions. Your
            private original stays private.
          </p>
          {href ? (
            <div className="grid gap-3">
              <p role="status">Shared live question created.</p>
              <a className="break-all text-sm underline" href={href}>
                Open shared question
              </a>
              <Button
                variant="outline"
                className="justify-self-start"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      new URL(href, window.location.origin).href,
                    )
                    setCopyState("copied")
                  } catch {
                    setCopyState("failed")
                  }
                }}
              >
                Copy authenticated link
              </Button>
              {copyState === "failed" ? (
                <p role="alert" className="text-sm">
                  Clipboard unavailable. Use the shared question link above.
                </p>
              ) : null}
              {copyState === "copied" ? (
                <p role="status" className="text-sm">
                  Link copied. It grants no access by itself.
                </p>
              ) : null}
            </div>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (confirmed && !share.isPending) {
                  share.mutate()
                }
              }}
            >
              <label className="grid gap-2 text-sm">
                Shared question name
                <Input
                  value={title}
                  maxLength={120}
                  required
                  disabled={share.isPending}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={confirmed}
                  disabled={share.isPending}
                  onCheckedChange={(value) => setConfirmed(value === true)}
                />
                <span>
                  I intend to share this title and selection with the permitted
                  members of this project.
                </span>
              </label>
              <Button
                type="submit"
                disabled={!confirmed || !title.trim() || share.isPending}
                className="justify-self-start"
              >
                {share.isPending ? "Sharing…" : "Create shared question"}
              </Button>
            </form>
          )}
          {share.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {share.error.message} Your question is preserved; retry when
                available.
              </AlertDescription>
            </Alert>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
