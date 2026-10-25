import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { Effect, Option } from "effect"
import { readDashboardSession } from "../../lib/session"

export default async function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await Effect.runPromise(readDashboardSession())
  return Option.match(session, {
    onNone: () => <>{children}</>,
    onSome: () => redirect("/"),
  })
}
