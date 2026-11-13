import Link from "next/link"
import { Option } from "effect"
import { redirect } from "next/navigation"
import { getDashboardSession } from "../../../features/platform/server-runtime"
import { AccountSecurity } from "../../../features/settings/account-security"

export const dynamic = "force-dynamic"
/** Account controls remain available before project setup is complete. */
export default async function AccountSecurityPage() {
  const identity = Option.getOrNull(await getDashboardSession())
  if (!identity) {
    redirect("/sign-in")
  }
  return (
    <main className="mx-auto grid w-full max-w-3xl min-w-0 gap-6 px-4 py-8">
      <Link
        href="/settings?section=account"
        className="text-sm text-primary underline"
      >
        Back to account settings
      </Link>
      <AccountSecurity key={identity.user.id} />
    </main>
  )
}
