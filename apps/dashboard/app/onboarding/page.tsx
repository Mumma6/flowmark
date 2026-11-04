import { Option } from "effect"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { OnboardingFlow } from "../../features/onboarding/onboarding-flow"
import { getDashboardAccess } from "../../features/platform/server-runtime"

export const dynamic = "force-dynamic"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; mode?: string }>
}) {
  await cookies()
  const access = Option.getOrNull(await getDashboardAccess())
  if (!access) {
    redirect("/sign-in")
  }
  const state = Option.getOrNull(access.onboarding)
  const params = await searchParams
  const reviewMode = Boolean(state?.completedAt) && params.mode === "guide"
  if (state?.completedAt && !reviewMode) {
    redirect("/")
  }
  return (
    <OnboardingFlow
      email={access.session.user.email}
      apiOrigin={access.apiOrigin}
      initialStep={
        params.step ?? (reviewMode ? "project" : state?.step) ?? "project"
      }
      reviewMode={reviewMode}
    />
  )
}
