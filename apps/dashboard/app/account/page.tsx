import Link from "next/link"
import { Option } from "effect"
import { redirect } from "next/navigation"
import { getDashboardSession } from "../../features/platform/server-runtime"
import { AccountSettings } from "../../features/settings/account-settings"

export const dynamic = "force-dynamic"
export default async function AccountPage() {
  const identity = Option.getOrNull(await getDashboardSession())
  if (!identity) {
    redirect("/sign-in")
  }
  return (
    <main className="mx-auto grid max-w-3xl min-w-0 gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Your account</h1>
      <nav
        aria-label="Account navigation"
        className="flex flex-wrap gap-4 text-sm"
      >
        <Link href="/" className="text-primary underline">
          Studio
        </Link>
        <Link href="/account/security" className="text-primary underline">
          Security
        </Link>
        <Link href="/data-privacy" className="text-primary underline">
          Data &amp; privacy
        </Link>
      </nav>
      <AccountSettings key={identity.user.id} />
    </main>
  )
}
