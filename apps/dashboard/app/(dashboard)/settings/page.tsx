"use client"

import { useEffect, useState } from "react"
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@flowmark/ui"
import { PageHeading } from "../../dashboard-components"
import { LOCAL_DEV_EMAIL } from "@flowmark/db/demo"
import { authClient } from "../../../lib/auth-client"

export default function SettingsPage() {
  const session = authClient.useSession()
  const email = session.data?.user.email ?? ""
  const [writeKey, setWriteKey] = useState<string | null>(null)

  useEffect(() => {
    const created = sessionStorage.getItem("flowmark.newWriteKey")
    if (created) {
      setWriteKey(created)
      sessionStorage.removeItem("flowmark.newWriteKey")
    }
  }, [])

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title="Project settings"
        description="How this dashboard account connects to your application."
      />
      <Card>
        <CardHeader>
          <CardTitle>Signed-in account</CardTitle>
          <CardDescription>
            Dashboard access uses your email and password. The SDK uses a
            project write key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Signed in as <code>{email || "…"}</code>.
          </p>
          <Separator />
          {email === LOCAL_DEV_EMAIL ? (
            <p>
              The local harness already sends events with{" "}
              <code>FLOWMARK_API_KEY=fm_demo_write_local_only</code>. Sign-in
              only unlocks this project in the dashboard.
            </p>
          ) : (
            <p>
              Put the project write key in your app as{" "}
              <code>FLOWMARK_API_KEY</code>. It is shown once after
              registration.
            </p>
          )}
          {writeKey ? (
            <Alert>
              <AlertDescription>
                Your first write key is <code>{writeKey}</code>. Store it in
                the server environment. It will not be shown again.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
