"use client"

import { SetupPathTabs } from "../../connect/setup/setup-path-tabs"
import type { useOnboarding } from "../use-onboarding"

export function InstrumentStep({
  origin,
  snippet,
}: Pick<ReturnType<typeof useOnboarding>, "origin" | "snippet">) {
  return (
    <SetupPathTabs
      origin={origin}
      agentPrompt={snippet}
      onCopied={() => undefined}
    />
  )
}
