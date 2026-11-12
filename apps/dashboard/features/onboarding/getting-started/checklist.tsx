"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { Check } from "lucide-react"
import Link from "next/link"
import { type ReactNode } from "react"
import { CopyButton } from "../../shared/dashboard-components"
import { useApiOrigin } from "../../platform/runtime-config"
import { CreateProjectForm } from "../../projects/create-project-form"
import { useProjectKeys } from "../../projects/keys-query"
import { useProject } from "../../projects/project-context"
import {
  manualWorkflowSnippet,
  serverEnvironmentSnippet,
} from "../../connect/setup/setup-instructions"
import { AgentPromptBody } from "./agent-prompt-card"

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
  const { current, projects } = useProject()
  const hasProject = projects.length > 0
  const keys = useProjectKeys()
  const hasWriteKey = (keys.data?.apiKeys.length ?? 0) > 0
  const origin = useApiOrigin()
  const snippet = manualWorkflowSnippet(origin)

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
          <ChecklistRow done={hasWriteKey} title="Keep the write key">
            <p>
              Creating a project issues the first server write key. Create more
              or rotate keys in{" "}
              <Link
                href="/settings?section=keys"
                className="text-primary underline"
              >
                Settings → Ingestion keys
              </Link>
              . Studio sign-in is a different credential.
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
              Put the key on the server only. <code>FLOWMARK_API_URL</code> is
              the API origin, not <code>/v1/events</code>.
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6">
              {serverEnvironmentSnippet(origin)}
            </pre>
            <CopyButton
              value={serverEnvironmentSnippet(origin)}
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
                Use agent or manual setup in{" "}
                <Link href="/connect" className="text-primary underline">
                  Connect
                </Link>{" "}
                or{" "}
                <Link
                  href="/settings?section=setup"
                  className="text-primary underline"
                >
                  Settings → Setup help
                </Link>
                .
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
