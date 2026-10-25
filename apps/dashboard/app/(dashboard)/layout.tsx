import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { Effect, Option } from "effect"
import { DashboardShell } from "../dashboard-shell"
import { readDashboardSession } from "../../lib/session"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await Effect.runPromise(readDashboardSession())
  return Option.match(session, {
    onNone: () => redirect("/sign-in"),
    onSome: (value) => (
      <DashboardShell email={value.user.email}>{children}</DashboardShell>
    ),
  })
}
