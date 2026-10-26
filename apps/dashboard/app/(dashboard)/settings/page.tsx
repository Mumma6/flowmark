"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import { LOCAL_DEV_EMAIL } from "@flowmark/db/demo"
import { authClient } from "../../../lib/auth-client"
import { useTRPC } from "../../../lib/trpc"
import { PageHeading } from "../../dashboard-components"
import { AgentPromptCard } from "../../getting-started"
import { useProject } from "../../project-context"

type CreatedSecret = {
  readonly id: string
  readonly name: string
  readonly prefix: string
  readonly secret: string
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}

function SecretAlert({
  secret,
  label,
}: {
  secret: CreatedSecret
  label: string
}) {
  return (
    <Alert>
      <AlertDescription className="grid gap-3">
        <p>
          {label} <code>{secret.prefix}…</code>. Store it now. Flowmark will
          not show the full key again.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all text-xs">{secret.secret}</code>
          <CopyButton value={secret.secret} />
        </div>
      </AlertDescription>
    </Alert>
  )
}

function ProjectSettings() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { current, select } = useProject()
  const [name, setName] = useState(current?.name ?? "")
  const [newName, setNewName] = useState("")
  const [secret, setSecret] = useState<CreatedSecret | null>(null)
  useEffect(() => {
    setName(current?.name ?? "")
  }, [current?.id, current?.name])
  const create = useMutation(
    trpc.project.create.mutationOptions({
      onSuccess: (result) => {
        setSecret(result.writeKey)
        setNewName("")
        select(result.project.id)
      },
    }),
  )
  const rename = useMutation(
    trpc.project.rename.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries()
      },
    }),
  )
  if (!current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project</CardTitle>
          <CardDescription>Create a project to start ingesting runs.</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project</CardTitle>
        <CardDescription>
          Runs and keys belong to one project. Use a second project for
          staging or another application.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            rename.mutate({
              projectId: current.id,
              name,
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
          <Button type="submit" disabled={rename.isPending}>
            Save name
          </Button>
        </form>
        <Separator />
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            create.mutate({ name: newName })
          }}
        >
          <label className="grid gap-2 text-sm">
            <span className="font-medium">New project</span>
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Production"
              required
            />
          </label>
          <Button type="submit" disabled={create.isPending}>
            Create project
          </Button>
        </form>
        {secret ? (
          <SecretAlert
            secret={secret}
            label="The new project write key is"
          />
        ) : null}
        {rename.error || create.error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {rename.error?.message ?? create.error?.message}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}

function KeySettings() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { current } = useProject()
  const keys = useQuery({
    ...trpc.project.keys.queryOptions(current?.id ?? ""),
    enabled: Boolean(current),
  })
  const [writeName, setWriteName] = useState("Write key")
  const [browserName, setBrowserName] = useState("Browser key")
  const [origins, setOrigins] = useState("http://localhost:3000")
  const [secret, setSecret] = useState<CreatedSecret | null>(null)
  useEffect(() => {
    setSecret(null)
  }, [current?.id])
  const createWrite = useMutation(
    trpc.project.createWriteKey.mutationOptions({
      onSuccess: (created) => {
        setSecret(created)
        void queryClient.invalidateQueries()
      },
    }),
  )
  const rotate = useMutation(
    trpc.project.rotateWriteKey.mutationOptions({
      onSuccess: (created) => {
        setSecret(created)
        void queryClient.invalidateQueries()
      },
    }),
  )
  const revokeApi = useMutation(
    trpc.project.revokeApiKey.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries(),
    }),
  )
  const createBrowser = useMutation(
    trpc.project.createBrowserKey.mutationOptions({
      onSuccess: (created) => {
        setSecret(created)
        void queryClient.invalidateQueries()
      },
    }),
  )
  const revokeBrowser = useMutation(
    trpc.project.revokeBrowserKey.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries(),
    }),
  )
  if (!current) {
    return null
  }
  const error =
    keys.error ??
    createWrite.error ??
    rotate.error ??
    revokeApi.error ??
    createBrowser.error ??
    revokeBrowser.error
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingestion keys</CardTitle>
        <CardDescription>
          Applications write with a project key. Dashboard sign-in is a
          different credential and never replaces the SDK key.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {secret ? (
          <SecretAlert secret={secret} label="New key" />
        ) : null}
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            createWrite.mutate({ projectId: current.id, name: writeName })
          }}
        >
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Server write key</span>
            <Input
              value={writeName}
              onChange={(event) => setWriteName(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={createWrite.isPending}>
            Create write key
          </Button>
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
            {(keys.data?.apiKeys ?? []).map((key) => (
              <TableRow key={key.id}>
                <TableCell>{key.name}</TableCell>
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
                      disabled={rotate.isPending}
                      onClick={() =>
                        rotate.mutate({
                          projectId: current.id,
                          keyId: key.id,
                        })
                      }
                    >
                      Rotate
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={revokeApi.isPending}
                    onClick={() =>
                      revokeApi.mutate({
                        projectId: current.id,
                        keyId: key.id,
                      })
                    }
                  >
                    Revoke
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Separator />
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
              <span className="font-medium">Browser key name</span>
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
            {(keys.data?.browserKeys ?? []).map((key) => (
              <TableRow key={key.id}>
                <TableCell>{key.name}</TableCell>
                <TableCell>
                  <code>{key.prefix}…</code>
                </TableCell>
                <TableCell className="text-xs">
                  {key.allowedOrigins.join(", ")}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={revokeBrowser.isPending}
                    onClick={() =>
                      revokeBrowser.mutate({
                        projectId: current.id,
                        keyId: key.id,
                      })
                    }
                  >
                    Revoke
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AccountSettings() {
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
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Dashboard access uses your email and password. The SDK uses a
          project write key.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <p>
          Signed in as <code>{email || "…"}</code>
          {email === LOCAL_DEV_EMAIL
            ? ". The local harness already sends events with FLOWMARK_API_KEY=fm_demo_write_local_only."
            : "."}
        </p>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault()
            setError(null)
            const result = await authClient.updateUser({ name })
            if (result.error) {
              setError(result.error.message ?? "Could not update the name.")
              return
            }
            setMessage("Name saved.")
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
            const result = await authClient.changePassword({
              currentPassword,
              newPassword,
              revokeOtherSessions: false,
            })
            if (result.error) {
              setError(
                result.error.message ?? "Could not change the password.",
              )
              return
            }
            setCurrentPassword("")
            setNewPassword("")
            setMessage("Password updated.")
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
          <Button type="submit" className="justify-self-start">
            Change password
          </Button>
        </form>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title="Settings"
        description="Project, ingestion keys, a coding-agent prompt, and the signed-in account."
      />
      <ProjectSettings />
      <KeySettings />
      <AgentPromptCard />
      <AccountSettings />
    </div>
  )
}
