import { HarnessShell } from "../harness-shell"
import { SdkPlayground } from "../sdk-playground"

export default function DiagnosticsPage() {
  return (
    <HarnessShell diagnostics>
      <SdkPlayground />
    </HarnessShell>
  )
}
