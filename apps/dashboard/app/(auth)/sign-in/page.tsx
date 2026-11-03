import { AuthScreen } from "../../../features/auth/auth-screen"
import { localDevelopmentAccount } from "../../../features/platform/config-server"

export default function SignInPage() {
  return <AuthScreen mode="sign-in" localAccount={localDevelopmentAccount()} />
}
