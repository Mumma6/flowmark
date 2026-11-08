import { Suspense } from "react"
import { AgentConsentPage } from "../../../../features/connect/agent-consent-page"
export const metadata = {
  title: "Authorize agent | Flowmark",
  referrer: "no-referrer" as const,
  robots: { index: false, follow: false },
}
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading authorization…</p>}>
      <AgentConsentPage />
    </Suspense>
  )
}
