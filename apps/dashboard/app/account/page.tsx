import { Option } from "effect"
import { redirect } from "next/navigation"
import { getDashboardSession } from "../../features/platform/server-runtime"
import { AccountNavigation } from "../../features/settings/account-navigation"
import { AccountSettings } from "../../features/settings/account-settings"

export const dynamic = "force-dynamic"
export default async function AccountPage() {
  const identity = Option.getOrNull(await getDashboardSession())
  if (!identity) {
    redirect("/sign-in")
  }
  return (
    <main className="mx-auto grid max-w-3xl min-w-0 gap-6 px-4 py-8">
      <AccountNavigation current="account" />
      <h1 className="text-2xl font-semibold">Your account</h1>
      <AccountSettings key={identity.user.id} />
    </main>
  )
}
