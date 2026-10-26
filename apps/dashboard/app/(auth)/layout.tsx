import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Effect, Option } from "effect"
import { readDashboardSession } from "../../lib/session"

export const dynamic = "force-dynamic"

export default async function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  await cookies()
  const session = await Effect.runPromise(readDashboardSession())
  return Option.match(session, {
    onNone: () => <>{children}</>,
    onSome: () => redirect("/"),
  })
}
