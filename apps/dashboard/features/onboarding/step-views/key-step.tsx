"use client"

import { Alert, AlertDescription, AlertTitle } from "@flowmark/ui"
import { DataState } from "../../shared/dashboard-components"
import { SecretAlert } from "../../projects/create-project-form"

import type { useOnboarding } from "../use-onboarding"
import { WriteKeyRecovery } from "./write-key-recovery"

export function KeyStep({
  keys,
  createdSecret,
  hasWriteKey,
  current,
  setCreatedSecret,
}: Pick<
  ReturnType<typeof useOnboarding>,
  "keys" | "createdSecret" | "hasWriteKey" | "current" | "setCreatedSecret"
>) {
  if (!current || current.role !== "owner") {
    return (
      <Alert>
        <AlertTitle>Choose a project you own</AlertTitle>
        <AlertDescription>
          Only the owner can issue ingestion keys. Go back to select or create
          your own project. A shared project's read access does not grant key
          management.
        </AlertDescription>
      </Alert>
    )
  }
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
            another below without leaving setup.
          </AlertDescription>
        </Alert>
      ) : !keys.isPending && !keys.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            This project has no server write key. Read keys and browser keys
            cannot complete server SDK setup. Create a server write key below.
          </AlertDescription>
        </Alert>
      ) : null}
      <p className="text-xs leading-6 text-muted-foreground">
        Replace the placeholder with your saved write key. Keep the key out of
        Cursor chat, source control and browser code.
      </p>
      {!keys.isPending && !keys.error && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Need a new write key?
          </summary>
          <div className="mt-4">
            <WriteKeyRecovery
              key={current.id}
              projectId={current.id}
              onCreated={setCreatedSecret}
            />
          </div>
        </details>
      )}
    </>
  )
}
