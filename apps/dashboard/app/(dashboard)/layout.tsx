import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Effect, Option } from "effect"
import { DashboardShell } from "../dashboard-shell"
import { readDashboardSession } from "../../lib/session"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  await cookies()
  const session = await Effect.runPromise(readDashboardSession())
  return Option.match(session, {
    onNone: () => redirect("/sign-in"),
    onSome: (value) => (
      <DashboardShell email={value.user.email}>{children}</DashboardShell>
    ),
  })
}
