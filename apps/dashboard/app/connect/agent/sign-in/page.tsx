import { publicRegistrationEnabled } from "../../../../features/platform/config-server"
import { Array } from "effect"
import { AuthScreen } from "../../../../features/auth/auth-screen"

export const metadata = {
  title: "Sign in to authorize | Flowmark",
  referrer: "no-referrer" as const,
  robots: { index: false, follow: false },
}
export default async function AgentSignIn({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  Array.forEach(Object.entries(params), ([key, value]) => {
    if (typeof value === "string") {
      query.append(key, value)
    } else if (value) {
      Array.forEach(value, (item) => query.append(key, item))
    }
  })
  return (
    <AuthScreen
      registrationEnabled={publicRegistrationEnabled()}
      mode="sign-in"
      returnTo={`/connect/agent/consent?${query}`}
    />
  )
}
