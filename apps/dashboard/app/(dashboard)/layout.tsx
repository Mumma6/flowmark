import { Option } from "effect"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { InvestigationOwner } from "../../features/investigations/investigation-owner"
import { StudioShell } from "../../features/shell/studio-shell"
import {
  getDashboardAccess,
  getRemoteAgentAccess,
} from "../../features/platform/server-runtime"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  await cookies()
  const access = Option.getOrNull(await getDashboardAccess())
  if (!access) {
    redirect("/sign-in")
  }
  const state = Option.getOrNull(access.onboarding)
  if (state && !state.completedAt) {
    redirect(`/onboarding?step=${state.step}`)
  }
  return (
    <InvestigationOwner userId={access.session.user.id}>
      <StudioShell
        email={access.session.user.email}
        apiOrigin={access.apiOrigin}
        agentAccess={await getRemoteAgentAccess(access.apiOrigin)}
      >
        {children}
      </StudioShell>
    </InvestigationOwner>
  )
}
