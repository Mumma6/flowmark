"use client"

import { LOCAL_DEV_EMAIL } from "@flowmark/db/demo"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@flowmark/ui"
import { EmailVerificationPanel } from "../auth/verification/email-verification-panel"
import { authClient } from "../auth/auth-client"
import { AccountNameForm } from "./account-name-form"
import { AccountPasswordForm } from "./account-password-form"

export function AccountSettings({
  verificationLinkFailed = false,
}: {
  readonly verificationLinkFailed?: boolean
}) {
  const session = authClient.useSession()
  const email = session.data?.user.email ?? ""
  const sessionName = session.data?.user.name ?? ""

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Dashboard access uses your email and password. The SDK uses a project
          write key from the API keys section.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <p className="text-sm leading-6 text-muted-foreground">
          Signed in as <code>{email || "…"}</code>
          {email === LOCAL_DEV_EMAIL
            ? ". The local harness already sends events with FLOWMARK_API_KEY=fm_demo_write_local_only."
            : "."}
        </p>
        <EmailVerificationPanel
          key={session.data?.user.id ?? "session"}
          user={session.data?.user ?? null}
          loading={session.isPending}
          sessionError={Boolean(session.error)}
          linkFailed={verificationLinkFailed}
          refresh={() => session.refetch()}
        />
        <Separator />
        <AccountNameForm sessionName={sessionName} />
        <Separator />
        <AccountPasswordForm />
      </CardContent>
    </Card>
  )
}
