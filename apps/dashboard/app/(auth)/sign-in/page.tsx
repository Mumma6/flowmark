import { AuthScreen } from "../auth-screen"

const localAccount =
  process.env.NODE_ENV !== "production" && !process.env.VERCEL_ENV
    ? {
        email: "local@dev",
        password: "local-dev-only",
      }
    : undefined

export default function SignInPage() {
  return <AuthScreen mode="sign-in" localAccount={localAccount} />
}
