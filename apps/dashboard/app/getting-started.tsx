"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import Link from "next/link"
import { Check } from "lucide-react"
import { flowmarkAgentPrompt, flowmarkApiOrigin } from "./agent-prompt"
import { CreateProjectForm } from "./create-project-form"
import { CopyButton } from "./dashboard-components"
import { useTRPC } from "../lib/trpc"
import { useProject } from "./project-context"

const storageKey = "flowmark.dashboard.onboarding.dismissed"

const installSnippet = (origin: string) => `npm i @flowmarkdev/node

FLOWMARK_API_KEY=<write-key-from-settings>
FLOWMARK_API_URL=${origin}

import { createFlowmark } from "@flowmarkdev/node"

export const flowmark = createFlowmark()

const flow = flowmark.workflow("example.process")
flow.step("started")
await flow.operation("work", async () => {
  // existing application work
})
flow.done({ result: { ok: true } })`

function AgentPromptBody() {
  const prompt = flowmarkAgentPrompt(flowmarkApiOrigin())
  return (
    <div className="grid gap-3">
      <p className="text-sm leading-6 text-muted-foreground">
        Put the write key in the server environment yourself. This prompt does
        not contain it. Install with <code>npm i @flowmarkdev/node</code>.
      </p>
      <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6 whitespace-pre-wrap">
        {prompt}
      </pre>
      <CopyButton value={prompt} label="Copy prompt" />
    </div>
  )
}

export function AgentPromptCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coding agent</CardTitle>
        <CardDescription>
          Paste this into your agent chat. It tells the agent to add{" "}
          <code>@flowmarkdev/node</code>, set the server environment, and look
          for processes where a workflow is worth marking.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AgentPromptBody />
      </CardContent>
    </Card>
  )
}

function ChecklistRow({
  done,
  title,
  required,
  children,
}: {
  done: boolean
  title: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <li className="grid gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={done ? "success" : "secondary"}
          className="inline-flex items-center gap-1"
        >
          {done ? (
            <>
              <Check size={12} aria-hidden="true" /> Done
            </>
          ) : required ? (
            "Required"
          ) : (
            "Next"
          )}
        </Badge>
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </li>
  )
}

export function GettingStartedChecklist({
  hasRuns,
  compact = false,
}: {
  hasRuns: boolean
  compact?: boolean
}) {
  const trpc = useTRPC()
  const { current, projects } = useProject()
  const hasProject = projects.length > 0
  const keys = useQuery({
    ...trpc.project.keys.queryOptions(current?.id ?? ""),
    enabled: Boolean(current?.id),
  })
  const hasWriteKey = (keys.data?.apiKeys.length ?? 0) > 0
  const origin = flowmarkApiOrigin()
  const snippet = installSnippet(origin)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {!hasProject
            ? "Create a project to continue"
            : hasRuns
              ? "Getting started"
              : "No runs yet — get started"}
        </CardTitle>
        <CardDescription>
          {!hasProject
            ? "Sign-up only creates your account. A project holds runs and ingestion keys — create one before you can instrument an app."
            : "Flowmark observes work your application already runs. It does not execute, schedule, or retry that work. Completed means the application reported completion — not that every record succeeded."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3" aria-label="Getting started checklist">
          <ChecklistRow
            done={hasProject}
            required={!hasProject}
            title="Create a project"
          >
            {hasProject ? (
              <p>
                Active project: <strong>{current?.name ?? "Selected"}</strong>.
                Add another in{" "}
                <Link
                  href="/settings?section=projects"
                  className="text-primary underline"
                >
                  Settings → Projects
                </Link>
                .
              </p>
            ) : (
              <CreateProjectForm />
            )}
          </ChecklistRow>
          <ChecklistRow
            done={hasWriteKey}
            title="Keep the write key"
          >
            <p>
              Creating a project issues the first server write key. Create more
              or rotate keys in{" "}
              <Link
                href="/settings?section=keys"
                className="text-primary underline"
              >
                Settings → Ingestion keys
              </Link>
              . Dashboard sign-in is a different credential.
            </p>
            {hasWriteKey ? (
              <p>This project already has at least one write key.</p>
            ) : hasProject ? (
              <Button asChild size="sm" className="justify-self-start">
                <Link href="/settings?section=keys">Open ingestion keys</Link>
              </Button>
            ) : (
              <p>Finish creating a project above to receive the first key.</p>
            )}
          </ChecklistRow>
          <ChecklistRow
            done={hasRuns}
            title="Install the SDK and set environment"
          >
            <p>
              Put the key on the server only.{" "}
              <code>FLOWMARK_API_URL</code> is the API origin, not{" "}
              <code>/v1/events</code>.
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6">
              {`FLOWMARK_API_KEY=<write key>
FLOWMARK_API_URL=${origin}`}
            </pre>
            <CopyButton
              value={`FLOWMARK_API_KEY=<write key>\nFLOWMARK_API_URL=${origin}`}
              label="Copy env"
            />
          </ChecklistRow>
          <ChecklistRow done={hasRuns} title="Mark one process">
            <p>
              Wrap a real process — not ordinary CRUD. Prefer work with
              operations, progress, or a useful reported result.
            </p>
            {!compact && hasProject && (
              <>
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6">
                  {snippet}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <CopyButton value={snippet} label="Copy snippet" />
                </div>
                <AgentPromptBody />
              </>
            )}
            {compact && (
              <p>
                Use the coding-agent prompt in{" "}
                <Link
                  href="/settings?section=setup"
                  className="text-primary underline"
                >
                  Settings → Setup help
                </Link>{" "}
                or expand Getting started on Overview.
              </p>
            )}
            {!hasProject && (
              <p>Create a project first, then install the SDK.</p>
            )}
          </ChecklistRow>
          <ChecklistRow done={hasRuns} title="Open the first run">
            {hasRuns ? (
              <p>
                Runs are arriving. Open{" "}
                <Link href="/runs" className="text-primary underline">
                  Runs
                </Link>{" "}
                or a workflow to inspect timeline, operations, and reported
                outcomes.
              </p>
            ) : (
              <p>
                When the API receives telemetry, the run appears here. Refresh
                Overview after your app reports one execution.
              </p>
            )}
          </ChecklistRow>
        </ol>
      </CardContent>
    </Card>
  )
}

export function OnboardingGuide({ hasRuns }: { hasRuns: boolean }) {
  const { projects, pending } = useProject()
  const hasProject = projects.length > 0
  const [open, setOpen] = useState<boolean | null>(null)
  useEffect(() => {
    if (pending) {
      return
    }
    if (!hasProject) {
      setOpen(true)
      return
    }
    const dismissed = window.localStorage.getItem(storageKey) === "1"
    setOpen(!dismissed || !hasRuns)
  }, [hasProject, hasRuns, pending])
  if (open === null || pending) {
    return null
  }
  if (!open && hasProject) {
    return (
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          Getting started
        </Button>
      </div>
    )
  }
  const dismiss = () => {
    if (!hasProject) {
      return
    }
    window.localStorage.setItem(storageKey, "1")
    setOpen(false)
  }
  return (
    <div className="grid gap-3">
      <GettingStartedChecklist hasRuns={hasRuns} />
      {hasProject && hasRuns ? (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
            Dismiss guide
          </Button>
        </div>
      ) : null}
      {hasProject && !hasRuns ? (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
            Dismiss for now
          </Button>
        </div>
      ) : null}
    </div>
  )
}
