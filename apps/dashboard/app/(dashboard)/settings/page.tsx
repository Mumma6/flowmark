"use client"

import { Suspense, useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Alert,
  AlertDescription,
  AlertTitle,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flowmark/ui"
import Link from "next/link"
import { LOCAL_DEV_EMAIL } from "@flowmark/db/demo"
import { authClient } from "../../../lib/auth-client"
import { useTRPC } from "../../../lib/trpc"
import { PageHeading } from "../../dashboard-components"
import {
  CreateProjectForm,
  SecretAlert,
  type CreatedSecret,
} from "../../create-project-form"
import { AgentPromptCard } from "../../getting-started"
import { useProject } from "../../project-context"

type SettingsSection = "projects" | "keys" | "setup" | "account"

const sections: ReadonlyArray<{
  readonly id: SettingsSection
  readonly label: string
}> = [
  { id: "projects", label: "Projects" },
  { id: "keys", label: "Ingestion keys" },
  { id: "setup", label: "Setup help" },
  { id: "account", label: "Account" },
]

function ProjectSettings() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { current, projects, select } = useProject()
  const [name, setName] = useState(current?.name ?? "")
  useEffect(() => {
    setName(current?.name ?? "")
  }, [current?.id, current?.name])
  const rename = useMutation(
    trpc.project.rename.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries()
      },
    }),
  )
  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create your first project</CardTitle>
          <CardDescription>
            Sign-up only creates your account. A project is where runs and
            ingestion keys live — create one when you are ready to instrument an
            app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateProjectForm />
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Current project</CardTitle>
          <CardDescription>
            Runs and keys belong to one project. Switch projects in the sidebar,
            or create another for staging or a second application.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {projects.length > 1 ? (
            <label className="grid max-w-md gap-2 text-sm">
              <span className="font-medium">Active project</span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={current?.id ?? ""}
                onChange={(event) => select(event.target.value)}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {current ? (
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
                  maxLength={80}
                  required
                />
              </label>
              <Button type="submit" disabled={rename.isPending}>
                Save name
              </Button>
            </form>
          ) : null}
          {rename.error ? (
            <Alert variant="destructive">
              <AlertDescription>{rename.error.message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add another project</CardTitle>
          <CardDescription>
            Use a separate project per application or environment. Each project
            gets its own write key.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateProjectForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your projects</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">
                    {project.name}
                    {project.id === current?.id ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (current)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {project.createdAt.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    {project.id !== current?.id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => select(project.id)}
                      >
                        Switch
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function KeySettings() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { current, projects } = useProject()
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
  if (projects.length === 0 || !current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ingestion keys</CardTitle>
          <CardDescription>
            Create a project first. Keys belong to a project and authenticate
            the SDK — not your dashboard sign-in.
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
  const error =
    keys.error ??
    createWrite.error ??
    rotate.error ??
    revokeApi.error ??
    createBrowser.error ??
    revokeBrowser.error
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Server write keys</CardTitle>
          <CardDescription>
            For <code>{current.name}</code>. Applications write with a project
            key. Dashboard sign-in is a different credential.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {secret ? <SecretAlert secret={secret} label="New key" /> : null}
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
              {(keys.data?.apiKeys.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-sm text-muted-foreground"
                  >
                    No server keys yet.
                  </TableCell>
                </TableRow>
              ) : null}
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
              {(keys.data?.browserKeys.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-sm text-muted-foreground"
                  >
                    No browser keys yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
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
          Dashboard access uses your email and password. The SDK uses a project
          write key from the Ingestion keys section.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <p className="text-sm leading-6 text-muted-foreground">
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

function parseSection(value: string | null): SettingsSection {
  if (
    value === "projects" ||
    value === "keys" ||
    value === "setup" ||
    value === "account"
  ) {
    return value
  }
  return "projects"
}

function SettingsPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { projects } = useProject()
  const section = parseSection(searchParams.get("section"))
  const setSection = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("section", next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title="Settings"
        description="Create projects, manage ingestion keys, and update your account. Sign-up does not create a project automatically."
      />
      {projects.length === 0 ? (
        <Alert>
          <AlertTitle>No project yet</AlertTitle>
          <AlertDescription>
            Your account is ready. Create a project under Projects to get a
            write key and start recording runs.
          </AlertDescription>
        </Alert>
      ) : null}
      <Tabs value={section} onValueChange={setSection}>
        <TabsList
          aria-label="Settings sections"
          className="h-auto w-full flex-wrap justify-start gap-1"
        >
          {sections.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="projects" className="mt-6">
          <ProjectSettings />
        </TabsContent>
        <TabsContent value="keys" className="mt-6">
          <KeySettings />
        </TabsContent>
        <TabsContent value="setup" className="mt-6">
          <AgentPromptCard />
        </TabsContent>
        <TabsContent value="account" className="mt-6">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Loading settings…
        </p>
      }
    >
      <SettingsPageInner />
    </Suspense>
  )
}
