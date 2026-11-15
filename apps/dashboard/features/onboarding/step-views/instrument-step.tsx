"use client"

import { Alert, AlertDescription, AlertTitle, Button } from "@flowmark/ui"
import { SetupPathTabs } from "../../connect/setup/setup-path-tabs"

import type { useOnboarding } from "../use-onboarding"

export function InstrumentStep({
  current,
  origin,
  snippet,
  recoverKey,
}: Pick<ReturnType<typeof useOnboarding>, "current" | "origin" | "snippet"> & {
  readonly recoverKey: () => void
}) {
  return (
    <div className="grid gap-4">
      <SetupPathTabs
        origin={origin}
        agentPrompt={snippet}
        onCopied={() => undefined}
      />
      <Alert>
        <AlertTitle>Need a write key?</AlertTitle>
        <AlertDescription className="grid gap-3">
          <p>
            A write key is shown only once. Return to the key step to create
            another for {current?.name ?? "the selected project"}, then update
            your server environment.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="justify-self-start"
            onClick={recoverKey}
          >
            Return to key recovery
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
