import type { Metadata } from "next"
import { Result, Schema } from "effect"
import { ResetToken } from "../../../features/auth/recovery"
import { RecoveryForm } from "../../../features/auth/recovery-form"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Reset password | Flowmark",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const token = query.error
    ? undefined
    : Result.match(Schema.decodeUnknownResult(ResetToken)(query.token), {
        onSuccess: (value) => value,
        onFailure: () => undefined,
      })
  return <RecoveryForm mode="reset" token={token} />
}
