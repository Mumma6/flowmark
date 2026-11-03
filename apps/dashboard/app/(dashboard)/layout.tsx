import { Option } from "effect"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { DashboardShell } from "../../features/shell/dashboard-shell"
import { getDashboardAccess } from "../../features/platform/server-runtime"

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
    <DashboardShell
      email={access.session.user.email}
      apiOrigin={access.apiOrigin}
    >
      {children}
    </DashboardShell>
  )
}
