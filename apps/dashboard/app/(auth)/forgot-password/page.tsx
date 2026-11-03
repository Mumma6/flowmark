import type { Metadata } from "next"
import { RecoveryForm } from "../../../features/auth/recovery-form"

export const metadata: Metadata = {
  title: "Forgot password | Flowmark",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default function ForgotPasswordPage() {
  return <RecoveryForm mode="request" />
}
