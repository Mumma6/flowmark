"use client"
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@flowmark/ui"
import Link from "next/link"
import { useRef, useState } from "react"
import { authClient } from "../auth/auth-client"
import { useProject } from "../projects/project-context"
import { useProjectSharing } from "./use-project-sharing"

function SharingControls({
  projectId,
  userId,
  sessionId,
}: {
  readonly projectId: string
  readonly userId: string
  readonly sessionId: string
}) {
  const controls = useProjectSharing(projectId, userId, sessionId)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"viewer" | "business">("viewer")
  const [password, setPassword] = useState("")
  const [understood, setUnderstood] = useState(false)
  const [target, setTarget] = useState<{ userId: string; name: string } | null>(
    null,
  )
  const passwordInput = useRef<HTMLInputElement>(null)
  const list = controls.list
  const details = list.data
  const busy = controls.busy
  if (list.isPending) {
    return <p role="status">Loading project access…</p>
  }
  if (list.isError || !details || details.userId !== userId) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Project access is unavailable or your sign-in changed. Refresh the
          project list before trying again.{" "}
          <Button variant="outline" onClick={() => void controls.refresh()}>
            Refresh access
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  const owner = details.role === "owner"
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Project access · {details.projectName}</CardTitle>
          <CardDescription>
            Access applies to this project only. Diagnostic viewers see full
            evidence; business readers see activity metadata and owner-published
            fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <p className="text-sm">
            Your role:{" "}
            <strong>
              {owner
                ? "Owner"
                : details.role === "business"
                  ? "Business reader"
                  : "Diagnostic viewer"}
            </strong>
            . Owner: {details.ownerName}.
          </p>
          {!owner ? (
            <>
              <p className="text-sm text-muted-foreground">
                {details.role === "business"
                  ? "You can read project activity and owner-published fields. Raw diagnostics are withheld."
                  : "You can read full diagnostic evidence."}{" "}
                You can save your own live selections. Management belongs to the
                owner.
              </p>
              <div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setTarget({ userId, name: "this project" })}
                >
                  Leave project
                </Button>
              </div>
            </>
          ) : (
            <>
              <ul className="grid gap-3" aria-label="Project members">
                {details.members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <span className="min-w-0 break-all">
                      <strong>{member.name}</strong>
                      <br />
                      {member.email} ·{" "}
                      {member.role === "owner"
                        ? "Owner"
                        : member.role === "business"
                          ? "Business reader"
                          : "Diagnostic viewer"}
                    </span>
                    {member.role !== "owner" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          setTarget({
                            userId: member.userId,
                            name: member.name,
                          })
                        }
                      >
                        Remove {member.name}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                There is one fixed owner. Ownership transfer and owner removal
                are unavailable. Remove readers before deleting the project or
                your owning account.
              </p>
              <form
                className="grid max-w-md gap-4"
                aria-label="Invite a read-only colleague"
                aria-busy={busy}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (busy || !understood || !password) {
                    return
                  }
                  const submitted = password
                  setPassword("")
                  setUnderstood(false)
                  controls.invite.mutate({
                    projectId,
                    currentSessionId: sessionId,
                    email: email.trim().toLowerCase(),
                    password: submitted,
                    role,
                  })
                }}
              >
                <h3 className="font-medium">Invite a read-only colleague</h3>
                <label className="grid gap-2 text-sm">
                  Evidence access
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3"
                    value={role}
                    onChange={(e) =>
                      setRole(
                        e.target.value === "business" ? "business" : "viewer",
                      )
                    }
                    disabled={busy}
                  >
                    <option value="viewer">
                      Diagnostic viewer · full evidence
                    </option>
                    <option value="business">
                      Business reader · published evidence
                    </option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Colleague email
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    maxLength={254}
                    autoComplete="email"
                    required
                    disabled={busy}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  Current password
                  <Input
                    ref={passwordInput}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    maxLength={1024}
                    autoComplete="current-password"
                    required
                    disabled={busy}
                  />
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={understood}
                    onCheckedChange={(checked) =>
                      setUnderstood(checked === true)
                    }
                    disabled={busy}
                  />
                  <span>
                    {role === "business"
                      ? "I understand that this shares project-wide activity metadata and owner-published fields. A customer filter is not an access restriction."
                      : "I understand that this grants full diagnostic access, including properties and error details."}
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  The recipient must sign in and verify this mailbox before
                  accepting. Invitations expire after 72 hours. Reinviting an
                  address replaces its earlier link. Up to 25 members including
                  you.
                </p>
                <div>
                  <Button
                    type="submit"
                    disabled={busy || !understood || !password}
                  >
                    {controls.invite.isPending
                      ? "Sending invitation…"
                      : "Send invitation"}
                  </Button>
                </div>
              </form>
              <section
                className="grid gap-3"
                aria-labelledby="pending-project-invitations"
              >
                <h3 id="pending-project-invitations" className="font-medium">
                  Pending invitations
                </h3>
                {details.invitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No pending invitations.
                  </p>
                ) : (
                  <ul className="grid gap-3">
                    {details.invitations.map((invitation) => (
                      <li
                        key={invitation.id}
                        className="grid gap-3 rounded-lg border border-border p-3 text-sm"
                      >
                        <p className="break-all">{invitation.email}</p>
                        <p>
                          Expires{" "}
                          <time dateTime={invitation.expiresAt}>
                            {new Date(invitation.expiresAt).toLocaleString()}
                          </time>
                          .{" "}
                          {invitation.delivery === "submitted"
                            ? "Mail submitted; inbox delivery is unconfirmed."
                            : "Mail submission is unconfirmed. Review or resend."}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              setEmail(invitation.email)
                              setPassword("")
                              setUnderstood(false)
                              controls.clear()
                              passwordInput.current?.focus()
                            }}
                          >
                            Prepare resend
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              controls.revoke.mutate({
                                projectId,
                                id: invitation.id,
                              })
                            }
                          >
                            Revoke invitation
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
          {controls.error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{controls.error}</AlertDescription>
            </Alert>
          ) : null}
          {controls.message ? (
            <p role="status" className="text-sm">
              {controls.message}
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !controls.remove.isPending) {
            setTarget(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target?.userId === userId
                ? "Leave this project?"
                : "Remove this viewer?"}
            </DialogTitle>
            <DialogDescription>
              {target?.name} will lose project reads and delegated access.
              Downloaded data cannot be erased remotely. Independently copied
              API keys remain valid until the owner revokes or rotates them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={controls.remove.isPending}
              onClick={() => setTarget(null)}
            >
              Keep membership
            </Button>
            <Button
              variant="destructive"
              disabled={controls.remove.isPending}
              onClick={() =>
                target &&
                controls.remove.mutate(
                  { projectId, userId: target.userId },
                  { onSuccess: () => setTarget(null) },
                )
              }
            >
              {controls.remove.isPending
                ? "Removing…"
                : target?.userId === userId
                  ? "Leave project"
                  : "Remove viewer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {owner ? (
        <p className="text-sm text-muted-foreground">
          Suspect a key was copied?{" "}
          <Link
            href="/settings?section=keys"
            className="text-primary underline"
          >
            Review and revoke project keys
          </Link>
          . Rotation affects application producers independently of memberships.
        </p>
      ) : null}
    </div>
  )
}
export function ProjectSharingPanel() {
  const { current } = useProject()
  const identity = authClient.useSession()
  if (!current) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a project to review access.
      </p>
    )
  }
  if (!identity.data) {
    return <p role="status">Checking your account…</p>
  }
  return (
    <SharingControls
      key={`${current.id}:${identity.data.user.id}:${identity.data.session.id}`}
      projectId={current.id}
      userId={identity.data.user.id}
      sessionId={identity.data.session.id}
    />
  )
}
