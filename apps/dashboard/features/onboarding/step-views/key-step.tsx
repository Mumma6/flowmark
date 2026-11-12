"use client"

import { Alert, AlertDescription, AlertTitle } from "@flowmark/ui"
import { DataState } from "../../shared/dashboard-components"
import { SecretAlert } from "../../projects/create-project-form"

import type { useOnboarding } from "../use-onboarding"

export function KeyStep({
  keys,
  createdSecret,
  hasWriteKey,
}: Pick<
  ReturnType<typeof useOnboarding>,
  "keys" | "createdSecret" | "hasWriteKey"
>) {
  return (
    <>
      <DataState
        pending={keys.isPending}
        error={keys.error}
        retry={() => void keys.refetch()}
      />
      {createdSecret ? (
        <SecretAlert
          secret={createdSecret}
          label="Your new project write key is"
        />
      ) : !keys.isPending && !keys.error && hasWriteKey ? (
        <Alert>
          <AlertTitle>Write key created</AlertTitle>
          <AlertDescription>
            The full value is shown only once. Use the key you saved, or create
            another in Studio Settings after setup.
          </AlertDescription>
        </Alert>
      ) : !keys.isPending && !keys.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Go back and create a project before continuing.
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}
