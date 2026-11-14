import { invitationReturnPath } from "../../../features/project-sharing/invitation-location"
import { AuthScreen } from "../../../features/auth/auth-screen"
import {
  publicRegistrationEnabled,
  localDevelopmentAccount,
} from "../../../features/platform/config-server"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const params = await searchParams
  return (
    <AuthScreen
      returnTo={invitationReturnPath(params.returnTo)}
      mode="sign-in"
      registrationEnabled={publicRegistrationEnabled()}
      localAccount={localDevelopmentAccount()}
    />
  )
}
