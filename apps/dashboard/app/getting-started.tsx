"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Badge,
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
} from "@flowmark/ui"
import Link from "next/link"
import { Check } from "lucide-react"
import { flowmarkAgentPrompt, flowmarkApiOrigin } from "./agent-prompt"
import {
  CreateProjectForm,
  SecretAlert,
  type CreatedSecret,
} from "./create-project-form"
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
              Put the key on the server only. <code>FLOWMARK_API_URL</code> is
              the API origin, not <code>/v1/events</code>.
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

const steps = [
  {
    id: "project",
    title: "Create a project",
  },
  {
    id: "key",
    title: "Keep the write key",
  },
  {
    id: "install",
    title: "Install the SDK",
  },
  {
    id: "instrument",
    title: "Mark one process",
  },
  {
    id: "run",
    title: "Open the first run",
  },
] as const

export function OnboardingGuide({
  hasRuns,
  snapshotReady,
}: {
  hasRuns: boolean
  snapshotReady: boolean
}) {
  const trpc = useTRPC()
  const { current, projects, pending } = useProject()
  const hasProject = projects.length > 0
  const ready = !pending && (hasProject ? snapshotReady : true)
  const keys = useQuery({
    ...trpc.project.keys.queryOptions(current?.id ?? ""),
    enabled: Boolean(current?.id) && ready,
  })
  const hasWriteKey = (keys.data?.apiKeys.length ?? 0) > 0
  const [open, setOpen] = useState(false)
  const [decided, setDecided] = useState(false)
  const [step, setStep] = useState(0)
  const [createdSecret, setCreatedSecret] = useState<CreatedSecret | null>(null)
  const decidedOnce = useRef(false)
  const origin = flowmarkApiOrigin()
  const snippet = installSnippet(origin)

  useEffect(() => {
    if (!ready || decidedOnce.current) {
      return
    }
    decidedOnce.current = true
    if (!hasProject) {
      setStep(0)
      setOpen(true)
      setDecided(true)
      return
    }
    const dismissed = window.localStorage.getItem(storageKey) === "1"
    setOpen(!dismissed)
    setDecided(true)
  }, [hasProject, ready])

  if (!decided) {
    return null
  }

  const dismiss = () => {
    if (!hasProject) {
      return
    }
    window.localStorage.setItem(storageKey, "1")
    setOpen(false)
  }
  const currentStep = steps[step] ?? steps[0]

  return (
    <div>
      {!open && hasProject ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setStep(hasRuns ? 0 : hasWriteKey ? 2 : 1)
            setOpen(true)
          }}
        >
          Getting started
        </Button>
      ) : null}
      <Dialog
        open={open}
        disablePointerDismissal={!hasProject}
        onOpenChange={(next) => {
          if (!next) {
            dismiss()
            return
          }
          setOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-2xl" showCloseButton={hasProject}>
          <DialogHeader>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-primary">
              Step {step + 1} of {steps.length}
            </p>
            <DialogTitle>{currentStep.title}</DialogTitle>
            <DialogDescription>
              Flowmark observes work your application already runs. It does not
              execute, schedule, or retry that work.
            </DialogDescription>
          </DialogHeader>
          <ol
            className="grid grid-cols-5 gap-2"
            aria-label="Getting started steps"
          >
            {steps.map((item, index) => {
              const complete =
                (item.id === "project" && hasProject) ||
                (item.id === "key" && hasWriteKey) ||
                ((item.id === "install" ||
                  item.id === "instrument" ||
                  item.id === "run") &&
                  hasRuns)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`h-1.5 w-full rounded-full ${
                      index === step
                        ? "bg-primary"
                        : complete
                          ? "bg-primary/45"
                          : "bg-border"
                    }`}
                    aria-current={index === step ? "step" : undefined}
                    aria-label={item.title}
                    disabled={!hasProject && index > 0}
                    onClick={() => setStep(index)}
                  />
                </li>
              )
            })}
          </ol>
          <div className="grid gap-4 text-sm leading-6 text-muted-foreground">
            {currentStep.id === "project" ? (
              hasProject ? (
                <p>
                  Active project:{" "}
                  <strong className="text-foreground">
                    {current?.name ?? "Selected"}
                  </strong>
                  . Add another later in{" "}
                  <Link
                    href="/settings?section=projects"
                    className="text-primary underline"
                  >
                    Settings → Projects
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <p>
                    Sign-up only creates your account. A project holds runs and
                    ingestion keys.
                  </p>
                  <CreateProjectForm onCreated={setCreatedSecret} />
                </>
              )
            ) : null}
            {currentStep.id === "key" ? (
              <>
                <p>
                  Creating a project issues the first server write key. Create
                  more or rotate keys in{" "}
                  <Link
                    href="/settings?section=keys"
                    className="text-primary underline"
                  >
                    Settings → Ingestion keys
                  </Link>
                  . Dashboard sign-in is a different credential.
                </p>
                {createdSecret ? (
                  <SecretAlert
                    secret={createdSecret}
                    label="The new project write key is"
                  />
                ) : null}
                {keys.isPending ? (
                  <p role="status">Checking ingestion keys…</p>
                ) : hasWriteKey ? (
                  <p>This project already has at least one write key.</p>
                ) : (
                  <Button asChild size="sm" className="justify-self-start">
                    <Link href="/settings?section=keys">
                      Open ingestion keys
                    </Link>
                  </Button>
                )}
              </>
            ) : null}
            {currentStep.id === "install" ? (
              <>
                <p>
                  Put the key on the server only. <code>FLOWMARK_API_URL</code>{" "}
                  is the API origin, not <code>/v1/events</code>.
                </p>
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6 text-foreground">
                  {`FLOWMARK_API_KEY=<write key>
FLOWMARK_API_URL=${origin}`}
                </pre>
                <CopyButton
                  value={`FLOWMARK_API_KEY=<write key>\nFLOWMARK_API_URL=${origin}`}
                  label="Copy env"
                />
              </>
            ) : null}
            {currentStep.id === "instrument" ? (
              <>
                <p>
                  Wrap a real process — not ordinary CRUD. Prefer work with
                  operations, progress, or a useful reported result.
                </p>
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6 text-foreground">
                  {snippet}
                </pre>
                <CopyButton value={snippet} label="Copy snippet" />
                <AgentPromptBody />
              </>
            ) : null}
            {currentStep.id === "run" ? (
              hasRuns ? (
                <p>
                  Runs are arriving. Open{" "}
                  <Link href="/runs" className="text-primary underline">
                    Runs
                  </Link>{" "}
                  to inspect the timeline, operations, and the result your
                  application reported.
                </p>
              ) : (
                <p>
                  When the API receives telemetry, the run appears on Overview.
                  Completed means the application reported completion — not that
                  every record succeeded.
                </p>
              )
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              Back
            </Button>
            <div className="flex gap-2">
              {hasProject && step < steps.length - 1 ? (
                <Button type="button" variant="ghost" onClick={dismiss}>
                  Close
                </Button>
              ) : null}
              {step < steps.length - 1 ? (
                <Button
                  type="button"
                  disabled={currentStep.id === "project" && !hasProject}
                  onClick={() =>
                    setStep((value) => Math.min(steps.length - 1, value + 1))
                  }
                >
                  Next
                </Button>
              ) : (
                <Button type="button" disabled={!hasProject} onClick={dismiss}>
                  Done
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
