"use client"

import { Alert, AlertDescription, AlertTitle, Button } from "@flowmark/ui"
import Link from "next/link"
import { SetupPathTabs } from "../../connect/setup/setup-path-tabs"
import { setupRecoveryCopy } from "../../connect/setup/setup-instructions"

import type { useOnboarding } from "../use-onboarding"

export function InstrumentStep({
  current,
  origin,
  snippet,
}: Pick<ReturnType<typeof useOnboarding>, "current" | "origin" | "snippet">) {
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
          <p>{setupRecoveryCopy(origin, current?.name ?? null).lostKey}</p>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="justify-self-start"
          >
            <Link href="/settings?section=keys">Open ingestion keys</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
