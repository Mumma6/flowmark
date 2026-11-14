import { Option } from "effect"
import { redirect } from "next/navigation"
import { getDashboardSession } from "../../../features/platform/server-runtime"
import { AccountNavigation } from "../../../features/settings/account-navigation"
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
      <AccountNavigation current="security" />
      <h1 className="text-2xl font-semibold">Account security</h1>
      <AccountSecurity key={identity.user.id} />
    </main>
  )
}
