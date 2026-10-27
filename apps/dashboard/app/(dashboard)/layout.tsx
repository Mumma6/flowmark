import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Effect, Option } from "effect"
import { DashboardShell } from "../dashboard-shell"
import {
  readDashboardOnboarding,
  readDashboardSession,
} from "../../lib/session"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  await cookies()
  const session = await Effect.runPromise(readDashboardSession())
  const value = Option.match(session, {
    onNone: () => null,
    onSome: (current) => current,
  })
  if (!value) {
    redirect("/sign-in")
  }
  const onboarding = await Effect.runPromise(readDashboardOnboarding())
  const state = Option.match(onboarding, {
    onNone: () => null,
    onSome: (current) => current,
  })
  if (state && !state.completedAt) {
    redirect(`/onboarding?step=${state.step}`)
  }
  return <DashboardShell email={value.user.email}>{children}</DashboardShell>
}
