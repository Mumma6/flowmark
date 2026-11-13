import Link from "next/link"
import type { Metadata } from "next"
import { Effect, Match, Result } from "effect"
import { Alert, AlertDescription } from "@flowmark/ui"
import { runDashboardServer } from "../../../features/platform/server-runtime"
import { readEmailChangeResult } from "../../../features/settings/email-change/read-result"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Email change · Flowmark",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
}
export default async function EmailChangeResultPage() {
  const result = await runDashboardServer(
    readEmailChangeResult().pipe(Effect.result),
  )
  const message = Result.match(result, {
    onFailure: () =>
      "The result could not be loaded. Refresh this page or sign in to check the current account state.",
    onSuccess: (value) =>
      Match.value(value).pipe(
        Match.when(
          "check-new",
          () =>
            "Current address confirmed. Open the verification link at your new address to finish. If no usable message arrives, return to Account to review or replace the request.",
        ),
        Match.when(
          "delivery-failed",
          () =>
            "Current address confirmed, but new-address mail submission could not be confirmed. Your email has not changed. Return to Account to review or replace the request.",
        ),
        Match.when(
          "complete",
          () =>
            "Email change completed. Existing browser sessions and agent grants have been signed out. Sign in using your new address; your password, project ownership and project keys are unchanged.",
        ),
        Match.when(
          "complete-notice-failed",
          () =>
            "Email change completed and existing sessions signed out, but the previous-address security notice could not be confirmed. Sign in with the new address to retry that notice.",
        ),
        Match.when(
          null,
          () =>
            "No verified email-change result is available here. This link may be expired, cancelled, replaced, already used or opened with a different account signed in. Open a valid message link, or sign in to review your account.",
        ),
        Match.exhaustive,
      ),
  })
  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Account email change</h1>
      <Alert>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-4">
        <Link href="/account" className="text-sm text-primary underline">
          Review account
        </Link>
        <Link href="/sign-in" className="text-sm text-primary underline">
          Sign in
        </Link>
        <Link
          href="/account/security"
          className="text-sm text-primary underline"
        >
          Account security and sign-out
        </Link>
      </div>
    </main>
  )
}
