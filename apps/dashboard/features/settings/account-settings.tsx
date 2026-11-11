"use client"

import { LOCAL_DEV_EMAIL } from "@flowmark/db/demo"
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Separator,
  toast,
} from "@flowmark/ui"
import { Result } from "effect"
import { useEffect, useState, type FormEvent } from "react"
import { runBrowserAuth } from "../auth/auth-browser-runtime"
import { EmailVerificationPanel } from "../auth/verification/email-verification-panel"
import { authClient } from "../auth/auth-client"
import { changeAccountPassword, updateAccountName } from "../auth/operations"

export function AccountSettings({
  verificationLinkFailed = false,
}: {
  readonly verificationLinkFailed?: boolean
}) {
  const session = authClient.useSession()
  const email = session.data?.user.email ?? ""
  const [name, setName] = useState(session.data?.user.name ?? "")
  useEffect(() => {
    if (session.data?.user.name) {
      setName(session.data.user.name)
    }
  }, [session.data?.user.name])
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
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
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault()
            setError(null)
            const result = await runBrowserAuth(updateAccountName(name))
            Result.match(result, {
              onFailure: (error) => setError(error.reason),
              onSuccess: () =>
                toast.add({ title: "Name saved", type: "success" }),
            })
          }}
        >
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <Button type="submit">Save name</Button>
        </form>
        <Separator />
        <form
          className="grid gap-3 sm:max-w-md"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault()
            setError(null)
            const result = await runBrowserAuth(
              changeAccountPassword({ currentPassword, newPassword }),
            )
            Result.match(result, {
              onFailure: (error) => setError(error.reason),
              onSuccess: () => {
                setCurrentPassword("")
                setNewPassword("")
                toast.add({ title: "Password updated", type: "success" })
              },
            })
          }}
        >
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Current password</span>
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">New password</span>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <p className="text-sm text-muted-foreground">
            Changing your password signs out your other sessions.
          </p>
          <Button type="submit" className="justify-self-start">
            Change password
          </Button>
        </form>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
