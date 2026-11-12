"use client"

import Link from "next/link"
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
  Input,
} from "@flowmark/ui"
import { Result } from "effect"
import { useState } from "react"
import {
  cleanupRecoveryCode,
  parseCleanupRecoveryCode,
} from "./cleanup-recovery"
import { useAccountErasure } from "./use-account-erasure"

export function AccountPrivacyPanel({
  signedIn,
}: {
  readonly signedIn: boolean
}) {
  const cleanup = useAccountErasure()
  const [confirmation, setConfirmation] = useState("")
  const [password, setPassword] = useState("")
  const [understood, setUnderstood] = useState(false)
  const [recoveryInput, setRecoveryInput] = useState("")
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const operation = cleanup.operation
  return (
    <main className="mx-auto grid w-full max-w-3xl min-w-0 gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap justify-between gap-3">
        <Link
          href="/settings?section=privacy"
          className="text-sm text-primary underline underline-offset-4"
        >
          Project data &amp; privacy
        </Link>
        <Link
          href="/sign-in"
          className="text-sm text-primary underline underline-offset-4"
        >
          Sign in
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Account data &amp; privacy</CardTitle>
          <CardDescription>
            Permanently delete your account and its solely owned projects. You
            can reach this page before completing setup or creating a project.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {cleanup.error || recoveryError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {cleanup.error ?? recoveryError}
              </AlertDescription>
            </Alert>
          ) : null}
          {!cleanup.ready ? (
            <p role="status">Checking saved cleanup access…</p>
          ) : operation?.state === "live_data_deleted" ? (
            <section className="grid gap-3" role="status">
              <h2 className="font-medium">Account live data deleted</h2>
              <p className="text-sm">
                Your account, its solely owned projects, telemetry and
                authentication records have been removed. Old keys, sessions and
                recovery links cannot restore the deleted identity.
              </p>
              <p className="text-sm text-muted-foreground">
                Provider logs, delivered email and backups follow separate
                expiry and operator procedures. This is not a claim of immediate
                worldwide erasure.
              </p>
              <Link
                href="/sign-up"
                className="text-sm text-primary underline underline-offset-4"
              >
                Create a new account
              </Link>
            </section>
          ) : operation?.state === "purging" ? (
            <section
              className="grid gap-4"
              aria-labelledby="account-cleanup-progress"
            >
              <h2 id="account-cleanup-progress" className="font-medium">
                Account cleanup in progress
              </h2>
              <p role="status" aria-live="polite" className="text-sm">
                Deleted {operation.completedProjects} of{" "}
                {operation.counts.projects} projects.{" "}
                {operation.phase > 0
                  ? "Removing authentication and account records."
                  : "Removing complete project evidence and configuration."}
              </p>
              <p className="text-sm text-muted-foreground">
                Normal sign-in, project reads and writes are disabled. Closing
                this page pauses continuation safely. Keep your private recovery
                code to resume within 24 hours; after expiry, contact the
                operator. Confirmed cleanup cannot be cancelled.
              </p>
              {operation.failureCode ? (
                <p className="text-sm text-destructive">
                  The last batch failed. Earlier progress remains saved; retry
                  to continue.
                </p>
              ) : null}
              <div>
                {cleanup.running ? (
                  <Button variant="outline" onClick={cleanup.pause}>
                    Pause after this batch
                  </Button>
                ) : (
                  <Button onClick={cleanup.resume} disabled={cleanup.busy}>
                    Resume account cleanup
                  </Button>
                )}
              </div>
            </section>
          ) : signedIn ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                Deletion removes all solely owned projects, their keys and
                complete evidence, private selections, credentials, sessions and
                recovery records. Shared ownership blocks deletion without
                changing any data. Export downloads are not available yet;
                preserve any evidence you need before continuing.
              </p>
              {!operation ? (
                <div>
                  <Button
                    variant="outline"
                    onClick={cleanup.preview}
                    disabled={cleanup.busy}
                  >
                    Review account deletion
                  </Button>
                </div>
              ) : (
                <section
                  className="grid gap-4 rounded-lg border border-destructive/40 p-4"
                  aria-labelledby="account-deletion-scope"
                >
                  <h2 id="account-deletion-scope" className="font-medium">
                    Review permanent account deletion
                  </h2>
                  <p className="text-sm">
                    {operation.counts.projects} projects ·{" "}
                    {operation.counts.runs} complete runs ·{" "}
                    {operation.counts.events} events ·{" "}
                    {operation.counts.apiKeys} API keys ·{" "}
                    {operation.counts.browserKeys} browser keys ·{" "}
                    {operation.counts.oauthClients} registered OAuth clients ·{" "}
                    {operation.counts.delegatedGrants} delegated grant families
                  </p>
                  {operation.counts.oauthClients > 0 ? (
                    <p className="text-sm text-destructive">
                      Deleting OAuth clients registered to you also revokes
                      other people’s grants for those clients. Their projects
                      and telemetry remain intact.
                    </p>
                  ) : null}
                  {operation.counts.previewProjects.length ? (
                    <ul className="list-inside list-disc break-words text-sm">
                      {operation.counts.previewProjects.map((project) => (
                        <li key={project.id}>{project.name}</li>
                      ))}
                    </ul>
                  ) : null}
                  {operation.counts.projects >
                  operation.counts.previewProjects.length ? (
                    <p className="text-sm text-muted-foreground">
                      Showing the first{" "}
                      {operation.counts.previewProjects.length} project names.
                      All {operation.counts.projects} projects are included.
                    </p>
                  ) : null}
                  <Alert variant="destructive">
                    <AlertDescription>
                      Account and project access stops immediately after
                      confirmation. Live-data deletion is permanent. Backups,
                      provider logs and delivered email are handled separately.
                    </AlertDescription>
                  </Alert>
                  <form
                    className="grid gap-4"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const submittedPassword = password
                      setPassword("")
                      cleanup.confirm(confirmation, submittedPassword)
                    }}
                  >
                    <label className="grid gap-2 text-sm">
                      <span>Type DELETE MY ACCOUNT</span>
                      <Input
                        required
                        autoComplete="off"
                        value={confirmation}
                        onChange={(event) =>
                          setConfirmation(event.target.value)
                        }
                      />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span>Current password</span>
                      <Input
                        required
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </label>
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={understood}
                        onCheckedChange={setUnderstood}
                      />
                      <span>
                        I reviewed the account scope, permanent deletion and
                        separate backup limitations.
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="destructive"
                        type="submit"
                        disabled={
                          !understood ||
                          !cleanup.recovery ||
                          confirmation !== "DELETE MY ACCOUNT" ||
                          !password ||
                          cleanup.busy
                        }
                      >
                        Delete my account
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        disabled={cleanup.busy}
                        onClick={cleanup.cancelPreview}
                      >
                        Discard preview
                      </Button>
                    </div>
                  </form>
                </section>
              )}
            </>
          ) : !cleanup.recovery ? (
            <p className="text-sm text-muted-foreground">
              Sign in to review account deletion, or paste a saved cleanup
              recovery code below. A recovery code only controls its already
              confirmed cleanup.
            </p>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm">
                A saved cleanup was found in this tab. Check its status to
                continue.
              </p>
              <Button onClick={cleanup.checkStatus} disabled={cleanup.busy}>
                Check saved cleanup status
              </Button>
            </div>
          )}
          {cleanup.recovery && operation?.state !== "live_data_deleted" ? (
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">
                  Private cleanup recovery code
                </span>
                <Input
                  readOnly
                  autoComplete="off"
                  spellCheck={false}
                  value={cleanupRecoveryCode(cleanup.recovery)}
                />
                <span className="text-xs text-muted-foreground">
                  Copy and keep this code private. It grants only status and
                  resume for this cleanup, never access to telemetry. This tab
                  saves it until completion.
                </span>
              </label>
              {cleanup.recovery.confirmed &&
              operation?.state === "previewed" ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    If the confirmation response was interrupted, check its
                    status before trying again.
                  </p>
                  <div>
                    <Button
                      variant="outline"
                      onClick={cleanup.checkStatus}
                      disabled={cleanup.busy}
                    >
                      Check confirmation status
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          {operation?.state !== "live_data_deleted" &&
          operation?.state !== "previewed" ? (
            <form
              className="grid gap-3 border-t border-border pt-5"
              onSubmit={(event) => {
                event.preventDefault()
                Result.match(parseCleanupRecoveryCode(recoveryInput), {
                  onFailure: () =>
                    setRecoveryError("Paste a complete cleanup recovery code."),
                  onSuccess: (value) => {
                    setRecoveryError(null)
                    setRecoveryInput("")
                    cleanup.recover(value)
                  },
                })
              }}
            >
              <label className="grid gap-2 text-sm">
                <span>Resume with a recovery code</span>
                <Input
                  required
                  type="password"
                  autoComplete="off"
                  value={recoveryInput}
                  onChange={(event) => setRecoveryInput(event.target.value)}
                />
              </label>
              <div>
                <Button variant="outline" type="submit" disabled={cleanup.busy}>
                  Check recovery code
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
