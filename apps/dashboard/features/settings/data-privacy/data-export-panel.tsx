"use client"

import {
  Button,
  Checkbox,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@flowmark/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import { useEffect, useRef, useState } from "react"
import { useTRPC, useTRPCClient } from "../../platform/api-trpc"
import { useInvestigationOwner } from "../../investigations/investigation-owner"
import { downloadExportPart } from "./download-export-part"
import type { RouterOutputs } from "../../platform/api-types"

type ExportRequest = RouterOutputs["dataExports"]["create"]

export function DataExportPanel({
  projectId,
  owner,
}: {
  readonly projectId: string | null
  readonly owner: boolean
}) {
  const rpc = useTRPCClient()
  const trpc = useTRPC()
  const userId = useInvestigationOwner()
  const [scope, setScope] = useState("account")
  const target = scope === "project" ? projectId : null
  const [password, setPassword] = useState("")
  const [understood, setUnderstood] = useState(false)
  const [operation, setOperation] = useState<ExportRequest | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const latest = useQuery({
    queryKey: ["data-export", userId, target],
    queryFn: () => rpc.dataExports.latest.query({ projectId: target }),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const current = operation ?? latest.data ?? null
  const create = useMutation(
    trpc.dataExports.create.mutationOptions({
      gcTime: 0,
      onSuccess: (value) => {
        setOperation(value)
        setCursor(value.cursor)
        setFinished(false)
        setMessage(null)
      },
      onError: (error) => setMessage(error.message),
      onSettled: (): void => {
        create.reset()
      },
    }),
  )
  const cancel = useMutation(
    trpc.dataExports.cancel.mutationOptions({
      onSuccess: () => {
        setOperation(null)
        setCursor(null)
        setMessage(
          "Export cancelled. Previously downloaded files remain on your device.",
        )
        void latest.refetch()
      },
    }),
  )
  const download = useMutation({
    mutationFn: ({ id, cursor }: { id: string; cursor: string }) => {
      controller.current = new AbortController()
      return Effect.runPromise(
        downloadExportPart(id, cursor, controller.current.signal),
      )
    },
    gcTime: 0,
    onSuccess: (part) => {
      setCursor(part.nextCursor)
      setFinished(part.complete)
      setMessage(
        part.complete
          ? `Final part ${part.part} offered for download. Keep all parts; this is a live traversal, not a transaction snapshot.`
          : `Part ${part.part} offered for download. Continue to obtain the remaining categories.`,
      )
      if (part.complete && current) {
        setOperation({ ...current, state: "complete" })
      }
    },
    onError: () =>
      setMessage(
        "Download incomplete or unavailable. Retry this part, or start again after expiry or an access change. No completed file was offered by this failed attempt.",
      ),
  })
  const running = create.isPending || cancel.isPending || download.isPending
  const expired = current ? Date.parse(current.expiresAt) <= Date.now() : false
  return (
    <section
      className="grid gap-4 rounded-lg border border-border p-4"
      aria-label="Account and project data export"
    >
      <div>
        <h3 className="text-base font-semibold">Download your data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Account personal data and owner-authorized project data are separate.
          Diagnostic timeline copies and portable snapshots are limited views,
          not these exports.
        </p>
      </div>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const submitted = password
          setPassword("")
          create.mutate({ projectId: target, password: submitted })
        }}
      >
        <label className="grid gap-2 text-sm">
          <span>Export scope</span>
          <NativeSelect
            value={scope}
            disabled={running}
            onChange={(event) => {
              setScope(event.target.value)
              setFinished(false)
              setOperation(null)
              setCursor(null)
              setPassword("")
              setUnderstood(false)
              setMessage(null)
            }}
          >
            <NativeSelectOption value="account">
              My account personal data
            </NativeSelectOption>
            {owner && projectId && (
              <NativeSelectOption value="project">
                Selected project data (owner only)
              </NativeSelectOption>
            )}
          </NativeSelect>
        </label>
        <p className="text-sm text-muted-foreground">
          {scope === "account"
            ? "Includes your profile, memberships, private saved selections and safe connection metadata. Does not include project telemetry or other users’ profiles."
            : "Includes project settings, definitions, runs, raw events, member/invitation metadata and your private selections. Excludes other users’ private selections, credentials, derived projections and saved capture payloads."}
        </p>
        <p className="text-sm text-muted-foreground">
          Files can contain personal or sensitive application data. They stay on
          your device after source deletion or access revocation. Each part is
          read live with current access, within a 15-minute request window. Keep
          every numbered part; missing parts or a missing final marker mean an
          incomplete export. This is not a legal portability determination.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={understood}
            onCheckedChange={(value) => setUnderstood(value === true)}
          />
          <span>I understand the scope and local-file privacy risks.</span>
        </label>
        <label className="grid gap-2 text-sm">
          <span>Current password</span>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={1024}
          />
        </label>
        <Button
          type="submit"
          disabled={!understood || password.length === 0 || running}
        >
          {create.isPending ? "Preparing…" : "Prepare new export"}
        </Button>
      </form>
      {current && (
        <div className="grid gap-3 text-sm">
          <p>
            Cutoff: {current.cutoff}. Expires: {current.expiresAt}.
          </p>
          {expired ? (
            <p role="status">This export expired. Prepare a new export.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={running || finished}
                onClick={() =>
                  download.mutate({
                    id: current.id,
                    cursor: cursor ?? current.cursor,
                  })
                }
              >
                {download.isPending
                  ? "Downloading…"
                  : cursor === null
                    ? "Download / retry last part"
                    : "Download next part"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={create.isPending || cancel.isPending}
                onClick={() => {
                  controller.current?.abort()
                  cancel.mutate({ id: current.id })
                }}
              >
                Cancel export
              </Button>
            </div>
          )}
        </div>
      )}
      {(message || create.error || cancel.error || latest.error) && (
        <p role="status" className="text-sm text-muted-foreground">
          {message ??
            create.error?.message ??
            cancel.error?.message ??
            latest.error?.message}
        </p>
      )}
    </section>
  )
}
