"use client"

import { Alert, AlertDescription, Button } from "@flowmark/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTRPC } from "../../platform/api-trpc"
import type { CreatedSecret } from "../../projects/types"

export function WriteKeyRecovery({
  projectId,
  onCreated,
}: {
  readonly projectId: string
  readonly onCreated: (secret: CreatedSecret, projectId: string) => void
}) {
  const trpc = useTRPC()
  const client = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const create = useMutation(
    trpc.project.createWriteKey.mutationOptions({
      gcTime: 0,
      retry: false,
      onMutate: () => setError(null),
      onError: (failure) => setError(failure.message),
      onSuccess: () => {
        void client.invalidateQueries(trpc.project.keys.queryFilter(projectId))
      },
    }),
  )
  return (
    <div className="grid gap-3">
      <p className="text-xs leading-6 text-muted-foreground">
        Lost the original key? Create another server write key here and save its
        one-time value. Existing keys keep working; this does not rotate or
        revoke them. Never put the secret in browser code or local storage.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={create.isPending}
        onClick={() =>
          create.mutate(
            { projectId, name: "Setup recovery" },
            {
              onSuccess: (secret) => onCreated(secret, projectId),
              // Reset after the mounted observer has delivered the secret.
              onSettled: () => create.reset(),
            },
          )
        }
        className="justify-self-start"
      >
        {create.isPending
          ? "Creating write key…"
          : "Create another server write key"}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
