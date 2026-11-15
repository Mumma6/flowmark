import Link from "next/link"
import { RecoveryScreen } from "../features/support/recovery-screen"

export default function NotFound() {
  return (
    <RecoveryScreen
      title="Page not found"
      description="This address is not part of Studio. Sign in if you were following an old link."
    >
      <nav aria-label="Recovery" className="flex flex-wrap gap-4 text-sm">
        <Link href="/" className="text-primary underline underline-offset-4">
          Go to Studio
        </Link>
        <Link
          href="/sign-in"
          className="text-primary underline underline-offset-4"
        >
          Sign in
        </Link>
      </nav>
    </RecoveryScreen>
  )
}
