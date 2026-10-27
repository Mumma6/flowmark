import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Effect, Option } from "effect"
import { OnboardingFlow } from "../onboarding-flow"
import {
  readDashboardOnboarding,
  readDashboardSession,
} from "../../lib/session"

export const dynamic = "force-dynamic"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  await cookies()
  const session = await Effect.runPromise(readDashboardSession())
  const value = Option.match(session, {
    onNone: () => null,
    onSome: (current) => current,
  })
  if (!value) {
    redirect("/sign-in")
  }
  const onboarding = await Effect.runPromise(readDashboardOnboarding())
  const state = Option.match(onboarding, {
    onNone: () => null,
    onSome: (current) => current,
  })
  if (state?.completedAt) {
    redirect("/")
  }
  const params = await searchParams
  return (
    <OnboardingFlow
      email={value.user.email}
      initialStep={params.step ?? state?.step ?? "project"}
    />
  )
}
