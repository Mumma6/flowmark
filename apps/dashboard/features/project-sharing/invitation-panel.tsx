"use client"
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Result } from "effect"
import Link from "next/link"
import { useState } from "react"
import { authClient } from "../auth/auth-client"
import { runBrowserAuth } from "../auth/auth-browser-runtime"
import { signOut } from "../auth/operations"
import { EmailVerificationPanel } from "../auth/verification/email-verification-panel"
import { useTRPC } from "../platform/api-trpc"
import { storeProjectId } from "../projects/project-selection"
import { invitationPath } from "./invitation-location"

type Review = {
  projectId: string
  projectName: string
  inviterName: string
  expiresAt: string
  role: "viewer"
  action: "review" | "accept" | "decline"
}
function InvitationControls({
  id,
  token,
  sessionId,
}: {
  readonly id: string
  readonly token: string
  readonly sessionId: string
}) {
  const trpc = useTRPC()
  const cache = useQueryClient()
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [declined, setDeclined] = useState(false)
  const mutation = useMutation(
    trpc.projectSharing.review.mutationOptions({
      gcTime: 0,
      onMutate: () => {
        setError(null)
      },
      onSuccess: (value) => {
        if (value.action === "accept") {
          cache.clear()
          storeProjectId(value.projectId)
          window.location.assign("/")
        } else if (value.action === "decline") {
          setReview(null)
          setDeclined(true)
          window.history.replaceState(null, "", `/invitations/${id}`)
        } else {
          setReview(value)
        }
      },
      onError: (failure) => {
        setReview(null)
        setError(failure.message)
      },
      onSettled: (): void => {
        mutation.reset()
      },
    }),
  )
  const act = (action: "review" | "accept" | "decline") =>
    mutation.mutate({ id, token, currentSessionId: sessionId, action })
  return (
    <div className="grid gap-5">
      {declined ? (
        <p role="status">Invitation declined. No project access was added.</p>
      ) : review ? (
        <>
          <h2 className="text-lg font-semibold">Join {review.projectName}?</h2>
          <p className="text-sm">
            {review.inviterName} invited you as a read-only viewer. This grants
            full diagnostic reads for this project, including reported
            properties, errors and diagnostic downloads. It does not include
            other projects, key management, metadata changes or project
            deletion.
          </p>
          <p className="text-sm text-muted-foreground">
            Expires{" "}
            <time dateTime={review.expiresAt}>
              {new Date(review.expiresAt).toLocaleString()}
            </time>
            . Membership is tied to your current account. Accepting requires a
            fresh server check.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button disabled={mutation.isPending} onClick={() => act("accept")}>
              Accept diagnostic read access
            </Button>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => act("decline")}
            >
              Decline invitation
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm">
            Sign in with the invited, verified mailbox, then review the exact
            project and access before deciding. Opening this page does not join
            a project.
          </p>
          <div>
            <Button
              disabled={mutation.isPending || declined}
              onClick={() => act("review")}
            >
              {mutation.isPending
                ? "Checking invitation…"
                : "Review invitation"}
            </Button>
          </div>
        </>
      )}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {error} The link may be expired, replaced, revoked or for a
            different account.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
function InvitationAccountSwitch({ returnTo }: { readonly returnTo: string }) {
  const cache = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="grid gap-3">
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={async () => {
            if (pending) {
              return
            }
            setPending(true)
            setError(null)
            const result = await runBrowserAuth(signOut())
            Result.match(result, {
              onFailure: (failure) => {
                setError(failure.reason)
                setPending(false)
              },
              onSuccess: () => {
                cache.clear()
                window.location.assign(
                  `/sign-in?returnTo=${encodeURIComponent(returnTo)}`,
                )
              },
            })
          }}
        >
          {pending ? "Signing out…" : "Use a different account"}
        </Button>
      </div>
    </div>
  )
}
export function InvitationPanel({
  id,
  token,
}: {
  readonly id: string
  readonly token: string
}) {
  const identity = authClient.useSession()
  const returnTo = invitationPath(id, token)
  if (!returnTo) {
    return (
      <Alert>
        <AlertDescription>
          This invitation link is unavailable. Open the complete link from your
          email or ask the owner for a new invitation.
        </AlertDescription>
      </Alert>
    )
  }
  if (identity.isPending) {
    return <p role="status">Checking your sign-in…</p>
  }
  if (identity.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Your sign-in could not be checked.{" "}
          <Button variant="outline" onClick={() => void identity.refetch()}>
            Retry sign-in check
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project invitation</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {!identity.data ? (
          <>
            <p className="text-sm">
              Sign in or create an account with the invited mailbox. You must
              verify that mailbox before the project and invitation details can
              be shown.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link
                  href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
                >
                  Sign in to review
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={`/sign-up?returnTo=${encodeURIComponent(returnTo)}`}
                >
                  Create an account
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="break-all text-sm">
              Signed in as {identity.data.user.email}.
            </p>
            {!identity.data.user.emailVerified ? (
              <EmailVerificationPanel
                key={identity.data.user.id}
                user={identity.data.user}
                loading={false}
                sessionError={false}
                linkFailed={false}
                refresh={() => identity.refetch()}
                returnTo={returnTo}
              />
            ) : (
              <InvitationControls
                key={`${id}:${token}:${identity.data.user.id}:${identity.data.session.id}`}
                id={id}
                token={token}
                sessionId={identity.data.session.id}
              />
            )}
            <InvitationAccountSwitch returnTo={returnTo} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
