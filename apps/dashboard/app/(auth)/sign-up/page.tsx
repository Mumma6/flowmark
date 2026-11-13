import { invitationReturnPath } from "../../../features/project-sharing/invitation-location"
import { AuthScreen } from "../../../features/auth/auth-screen"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const params = await searchParams
  return (
    <AuthScreen
      returnTo={invitationReturnPath(params.returnTo)}
      mode="sign-up"
    />
  )
}
