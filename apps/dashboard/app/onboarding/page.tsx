import { Option } from "effect"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { OnboardingFlow } from "../../features/onboarding/onboarding-flow"
import { getDashboardAccess } from "../../lib/server-runtime"

export const dynamic = "force-dynamic"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  await cookies()
  const access = Option.getOrNull(await getDashboardAccess())
  if (!access) {
    redirect("/sign-in")
  }
  const state = Option.getOrNull(access.onboarding)
  if (state?.completedAt) {
    redirect("/")
  }
  const params = await searchParams
  return (
    <OnboardingFlow
      email={access.session.user.email}
      apiOrigin={access.apiOrigin}
      initialStep={params.step ?? state?.step ?? "project"}
    />
  )
}
