import { redirect } from "next/navigation"
import { publicRegistrationEnabled } from "../../../features/platform/config-server"
import { invitationReturnPath } from "../../../features/project-sharing/invitation-location"
import { AuthScreen } from "../../../features/auth/auth-screen"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; invite?: string }>
}) {
  const params = await searchParams
  const returnTo = invitationReturnPath(params.returnTo)
  const token =
    typeof params.invite === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(params.invite)
      ? params.invite
      : undefined
  if (!publicRegistrationEnabled() && !token) {
    redirect(
      `/sign-in${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`,
    )
  }
  return (
    <AuthScreen
      returnTo={returnTo}
      mode="sign-up"
      registrationEnabled={true}
      invitationToken={token}
    />
  )
}
