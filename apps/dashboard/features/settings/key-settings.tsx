"use client"

import { ProjectOwnerOnly } from "../project-sharing/project-owner-only"

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import Link from "next/link"
import { type FormEvent } from "react"
import { SecretAlert } from "../projects/create-project-form"
import { useKeySettings } from "./use-key-settings"

function KeySettingsContent() {
  const {
    current,
    projects,
    keys,
    readName,
    setReadName,
    createRead,
    writeName,
    setWriteName,
    browserName,
    setBrowserName,
    origins,
    setOrigins,
    secret,
    secretSource,
    notice,
    action,
    createWrite,
    createBrowser,
    busy,
    ask,
    closeAction,
    confirmAction,
    rotate,
    revokeApi,
    revokeBrowser,
  } = useKeySettings()
  if (projects.length === 0 || !current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            Create a project first. Keys belong to a project and authorize
            ingestion or reads — not your dashboard sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/settings?section=projects">Go to Projects</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  const actionError =
    createRead.error ??
    createWrite.error ??
    rotate.error ??
    revokeApi.error ??
    createBrowser.error ??
    revokeBrowser.error
  const apiKeys = keys.data?.apiKeys
  const browserKeys = keys.data?.browserKeys
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Server API keys</CardTitle>
          <CardDescription>
            For <code>{current.name}</code>. A write key authenticates the
            server SDK. It is not your dashboard sign-in. Emergency rotation
            revokes the selected key immediately and shows the replacement once.
            A request already accepted may still finish. To keep a key working
            while you deploy, create a new write key, update the application,
            then revoke the old one. If this page never shows the new secret,
            revoke the listed replacement and create another. Rotating the old
            key again does not recover it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {secret ? (
            <SecretAlert
              secret={secret}
              label={
                secretSource === "rotated"
                  ? "The replacement write key is"
                  : "New key"
              }
              detail={
                secretSource === "rotated"
                  ? "The previous key is already revoked. If you leave before copying this secret, revoke the new listed key and create another."
                  : undefined
              }
            />
          ) : null}
          {notice ? (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              createWrite.mutate({ projectId: current.id, name: writeName })
            }}
          >
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Key label</span>
              <Input
                value={writeName}
                onChange={(event) => setWriteName(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={createWrite.isPending}>
              Create write key
            </Button>
          </form>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              createRead.mutate({ projectId: current.id, name: readName })
            }}
          >
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Read key label</span>
              <Input
                value={readName}
                onChange={(event) => setReadName(event.target.value)}
                aria-describedby="read-key-help"
                required
                minLength={1}
                maxLength={80}
              />
            </label>
            <Button
              type="submit"
              disabled={createRead.isPending || !readName.trim()}
            >
              Create read key
            </Button>
            <p
              id="read-key-help"
              className="text-xs text-muted-foreground sm:col-span-2"
            >
              For server-side read clients. Keep this secret out of browsers.
              Read keys cannot ingest events.
            </p>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.isPending ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-sm text-muted-foreground"
                  >
                    <p role="status">Loading keys…</p>
                  </TableCell>
                </TableRow>
              ) : keys.isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm">
                    <p role="alert">Could not load server keys.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => void keys.refetch()}
                    >
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              ) : apiKeys?.length ? (
                apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="max-w-xs break-words">
                      {key.name}
                    </TableCell>
                    <TableCell>
                      <code>{key.prefix}…</code>
                    </TableCell>
                    <TableCell>{key.permission}</TableCell>
                    <TableCell className="tabular-nums">
                      {key.createdAt.slice(0, 10)}
                    </TableCell>
                    <TableCell className="flex flex-wrap gap-2">
                      {key.permission === "write" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={(event) =>
                            ask(
                              {
                                intent: "rotate",
                                kind: "api",
                                id: key.id,
                                name: key.name,
                                prefix: key.prefix,
                              },
                              event.currentTarget,
                            )
                          }
                        >
                          Rotate
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={(event) =>
                          ask(
                            {
                              intent: "revoke",
                              kind: "api",
                              id: key.id,
                              name: key.name,
                              prefix: key.prefix,
                            },
                            event.currentTarget,
                          )
                        }
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-sm text-muted-foreground"
                  >
                    No server keys yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Browser ingestion keys</CardTitle>
          <CardDescription>
            Public identifiers with an origin allowlist. Never grant reads.
            Browser events stay untrusted.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form
            className="grid gap-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              createBrowser.mutate({
                projectId: current.id,
                name: browserName,
                origins: origins.split(/\n|,/).map((item) => item.trim()),
              })
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Name</span>
                <Input
                  value={browserName}
                  onChange={(event) => setBrowserName(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Allowed origins</span>
                <Input
                  value={origins}
                  onChange={(event) => setOrigins(event.target.value)}
                  placeholder="http://localhost:3000"
                />
              </label>
            </div>
            <Button
              type="submit"
              className="justify-self-start"
              disabled={createBrowser.isPending}
            >
              Create browser key
            </Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Origins</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.isPending ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-sm text-muted-foreground"
                  >
                    <p role="status">Loading keys…</p>
                  </TableCell>
                </TableRow>
              ) : keys.isError ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm">
                    <p role="alert">Could not load browser keys.</p>
                  </TableCell>
                </TableRow>
              ) : browserKeys?.length ? (
                browserKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="max-w-xs break-words">
                      {key.name}
                    </TableCell>
                    <TableCell>
                      <code>{key.prefix}…</code>
                    </TableCell>
                    <TableCell className="break-words text-xs">
                      {key.allowedOrigins.join(", ")}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={(event) =>
                          ask(
                            {
                              intent: "revoke",
                              kind: "browser",
                              id: key.id,
                              name: key.name,
                              prefix: key.prefix,
                            },
                            event.currentTarget,
                          )
                        }
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-sm text-muted-foreground"
                  >
                    No browser keys yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError.message}</AlertDescription>
        </Alert>
      ) : null}
      <Dialog
        open={action !== null}
        disablePointerDismissal={busy}
        onOpenChange={(open) => {
          if (!open) {
            closeAction()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.intent === "rotate" ? "Rotate write key" : "Revoke key"}
            </DialogTitle>
            <DialogDescription>
              {action?.intent === "rotate"
                ? `Emergency rotation in ${current.name} replaces ${action.name} (${action.prefix}…) immediately. The current secret stops working. A request already accepted may still finish. The new secret is shown once and cannot be recovered.`
                : `Revoke ${action?.name ?? "this key"} (${action?.prefix ?? ""}…) in ${current.name}. Applications using it can no longer authenticate. This does not delete stored runs.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={closeAction}
            >
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={confirmAction}>
              {busy
                ? action?.intent === "rotate"
                  ? "Rotating…"
                  : "Revoking…"
                : action?.intent === "rotate"
                  ? "Rotate now"
                  : "Revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function KeySettings() {
  return (
    <ProjectOwnerOnly>
      <KeySettingsContent />
    </ProjectOwnerOnly>
  )
}
