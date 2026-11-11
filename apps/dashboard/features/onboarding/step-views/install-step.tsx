"use client"

import type { useOnboarding } from "../use-onboarding"
import { SetupCode } from "../setup-code"

export function InstallStep({
  origin,
}: Pick<ReturnType<typeof useOnboarding>, "origin">) {
  return (
    <div className="grid gap-5">
      <SetupCode title="Terminal" value="npm i @flowmarkdev/node" />
      <SetupCode
        title="Server environment"
        value={`FLOWMARK_API_KEY=<write key>\nFLOWMARK_API_URL=${origin}`}
      />
    </div>
  )
}
