import { HarnessShell } from "./harness-shell"
import { OperationsApp } from "./operations-app"

export default function HomePage() {
  return (
    <HarnessShell>
      <OperationsApp />
    </HarnessShell>
  )
}
