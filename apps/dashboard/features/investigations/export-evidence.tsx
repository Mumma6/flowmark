"use client"
import { Button } from "@flowmark/ui"
import { useMutation } from "@tanstack/react-query"
import type { SavedEvidenceExport } from "@flowmarkdev/core"
/** Fetch on every click. Keep only a receipt in React, never a cached export body. */
export function ExportEvidence({
  load,
  captured = false,
}: {
  readonly load: () => Promise<SavedEvidenceExport>
  readonly captured?: boolean
}) {
  const copy = useMutation({
    mutationFn: async () => {
      const value = await load()
      await navigator.clipboard.writeText(JSON.stringify(value))
    },
    retry: false,
    gcTime: 0,
  })
  return (
    <div className="grid justify-items-start gap-2">
      <Button
        variant="outline"
        disabled={copy.isPending}
        onClick={() => copy.mutate()}
      >
        {copy.isPending
          ? "Checking export access…"
          : captured
            ? "Copy captured evidence JSON"
            : "Copy live question JSON"}
      </Button>
      {copy.isSuccess ? (
        <p role="status" className="text-sm">
          JSON copied.{" "}
          {captured
            ? "This is a past observation with the recorded expiry."
            : "This question recomputes from retained evidence when reopened."}{" "}
          Delivered copies cannot be recalled and grant no access.
        </p>
      ) : null}
      {copy.error ? (
        <p role="alert" className="text-sm">
          {copy.error.message} Nothing was copied. Check your access and
          clipboard permissions, then retry.
        </p>
      ) : null}
    </div>
  )
}
