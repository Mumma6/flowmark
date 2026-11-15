"use client"

import { Button } from "@flowmark/ui"
import { RecoveryScreen } from "../features/support/recovery-screen"

export default function StudioError({
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  return (
    <RecoveryScreen
      title="This page could not be loaded"
      description="Studio hit an unexpected error. Trying again repeats only this page load."
    >
      <Button type="button" className="w-fit" onClick={() => retry()}>
        Try again
      </Button>
    </RecoveryScreen>
  )
}
