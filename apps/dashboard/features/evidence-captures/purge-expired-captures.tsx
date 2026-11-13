"use client"
import { Button } from "@flowmark/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTRPCClient } from "../platform/api-trpc"
export function PurgeExpiredCaptures({
  projectId,
}: {
  readonly projectId: string
}) {
  const client = useTRPCClient(),
    cache = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)
  const purge = useMutation({
    mutationFn: () =>
      client.evidenceCaptures.purgeExpired.mutate({ projectId }),
    retry: false,
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["evidence-captures"] })
      void cache.invalidateQueries({ queryKey: ["captured-evidence"] })
    },
  })
  return (
    <div className="grid justify-items-start gap-2 rounded-lg border border-border p-4">
      <Button
        variant="outline"
        disabled={purge.isPending}
        onClick={() => setConfirmed((value) => !value)}
      >
        Remove expired captures
      </Button>
      {confirmed ? (
        <>
          <p className="text-sm">
            Permanently remove up to 25 expired captured copies in this project.
            Source telemetry and saved live questions keep their own lifecycle.
            Each batch can be retried or continued safely.
          </p>
          <Button
            variant="destructive"
            disabled={purge.isPending}
            onClick={() => purge.mutate()}
          >
            {purge.isPending
              ? "Removing expired copies…"
              : purge.data?.hasMore
                ? "Continue expired cleanup"
                : "Confirm expired cleanup"}
          </Button>
          <Button
            variant="outline"
            disabled={purge.isPending}
            onClick={() => setConfirmed(false)}
          >
            Close cleanup
          </Button>
        </>
      ) : null}
      {purge.isSuccess ? (
        <p role="status" className="text-sm">
          Removed {purge.data.deleted} expired captures in this batch.{" "}
          {purge.data.hasMore
            ? "More remain; continue cleanup."
            : "No more expired captures were found in this batch."}
        </p>
      ) : null}
      {purge.error ? (
        <p role="alert" className="text-sm">
          {purge.error.message} This batch failed. Retry to resume cleanup.
        </p>
      ) : null}
    </div>
  )
}
