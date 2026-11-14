import { Option } from "effect"
import { cookies } from "next/headers"
import { getDashboardSession } from "../../features/platform/server-runtime"
import { AccountPrivacyPanel } from "../../features/settings/account-privacy/account-privacy-panel"

export const dynamic = "force-dynamic"

/** Deliberately outside onboarding/project guards: cleanup outlives normal sign-in. */
export default async function AccountPrivacyPage() {
  await cookies()
  const identity = Option.getOrNull(await getDashboardSession())
  return (
    <AccountPrivacyPanel
      key={identity?.user.id ?? "cleanup"}
      signedIn={identity !== null}
    />
  )
}
