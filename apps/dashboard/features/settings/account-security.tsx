"use client"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Separator,
} from "@flowmark/ui"
import { AccountPasswordForm } from "./account-password-form"
import { AccountSessionsPanel } from "./sessions/account-sessions-panel"

export function AccountSecurity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account security</CardTitle>
        <CardDescription>
          Manage your password and active browser sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <AccountPasswordForm />
        <Separator />
        <AccountSessionsPanel />
      </CardContent>
    </Card>
  )
}
