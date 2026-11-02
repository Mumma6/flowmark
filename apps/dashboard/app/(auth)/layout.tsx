import { Option } from "effect"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { getDashboardSession } from "../../lib/server-runtime"

export const dynamic = "force-dynamic"

export default async function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  await cookies()
  const session = await getDashboardSession()
  return Option.match(session, {
    onNone: () => <>{children}</>,
    onSome: () => redirect("/"),
  })
}
