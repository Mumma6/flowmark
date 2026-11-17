import { Option } from "effect"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { OnboardingFlow } from "../../features/onboarding/onboarding-flow"
import {
  getDashboardAccess,
  getRemoteAgentAccess,
} from "../../features/platform/server-runtime"
import { initialSetupStep } from "../../features/onboarding/onboarding-state"

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
  const reviewMode =
    Boolean(state?.completedAt || state?.sharedAccess) &&
    params.mode === "guide"
  if ((state?.completedAt || state?.sharedAccess) && !reviewMode) {
    redirect("/")
  }
  return (
    <OnboardingFlow
      userId={access.session.user.id}
      email={access.session.user.email}
      apiOrigin={access.apiOrigin}
      agentAccess={await getRemoteAgentAccess(access.apiOrigin)}
      initialStep={initialSetupStep(state?.step, params.step, reviewMode)}
      reviewMode={reviewMode}
    />
  )
}
