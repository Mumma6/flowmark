"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { flowmarkAgentPrompt, flowmarkApiOrigin } from "./agent-prompt"
import {
  CreateProjectForm,
  SecretAlert,
  type CreatedSecret,
} from "./create-project-form"
import { CopyButton } from "./dashboard-components"
import { ProjectProvider, useProject } from "./project-context"
import { useTRPC } from "../lib/trpc"

type OnboardingStep = "project" | "key" | "install" | "instrument" | "run"

const steps: ReadonlyArray<{
  readonly id: OnboardingStep
  readonly title: string
}> = [
  { id: "project", title: "Create a project" },
  { id: "key", title: "Save your write key" },
  { id: "install", title: "Install the SDK" },
  { id: "instrument", title: "Mark one process" },
  { id: "run", title: "Open your first run" },
]

const stepIndex = (value: string): number => {
  const index = steps.findIndex((step) => step.id === value)
  return index >= 0 ? index : 0
}

function OnboardingContent({
  email,
  initialStep,
}: {
  email: string
  initialStep: string
}) {
  const trpc = useTRPC()
  const router = useRouter()
  const { current, projects } = useProject()
  const [step, setStep] = useState(() => stepIndex(initialStep))
  const [createdSecret, setCreatedSecret] = useState<CreatedSecret | null>(null)
  const currentStep = steps[step] ?? steps[0]!
  const keys = useQuery({
    ...trpc.project.keys.queryOptions(current?.id ?? ""),
    enabled: Boolean(current?.id),
  })
  const snapshot = useQuery({
    ...trpc.project.snapshot.queryOptions(),
    enabled: Boolean(current?.id),
  })
  const hasWriteKey = (keys.data?.apiKeys.length ?? 0) > 0
  const hasRuns = (snapshot.data?.metrics.totalRuns ?? 0) > 0
  const advance = useMutation(
    trpc.onboarding.advance.mutationOptions({
      onSuccess: () => undefined,
    }),
  )
  const complete = useMutation(
    trpc.onboarding.complete.mutationOptions({
      onSuccess: () => {
        router.push("/")
        router.refresh()
      },
    }),
  )
  const origin = flowmarkApiOrigin()
  const snippet = useMemo(
    () => `${flowmarkAgentPrompt(origin)}\n\nFLOWMARK_API_URL=${origin}`,
    [origin],
  )

  const goTo = (next: number) => {
    const nextStep = steps[next]
    if (!nextStep) {
      return
    }
    advance.mutate(
      { step: nextStep.id },
      {
        onSuccess: () => setStep(next),
      },
    )
  }

  const next = () => {
    if (step === steps.length - 1) {
      complete.mutate()
      return
    }
    goTo(step + 1)
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
              Flowmark setup
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Make your first process observable
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Welcome, {email}. We will create a project, connect your
              application, and help you inspect your application's activity.
            </p>
          </div>
          <Badge variant="outline">
            Step {step + 1} of {steps.length}
          </Badge>
        </header>

        <div className="grid gap-2">
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={((step + 1) / steps.length) * 100}
          >
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
          <ol
            className="grid gap-2 sm:grid-cols-5"
            aria-label="Onboarding steps"
          >
            {steps.map((item, index) => (
              <li
                key={item.id}
                className={
                  index <= step
                    ? "text-xs font-medium text-foreground"
                    : "text-xs text-muted-foreground"
                }
              >
                {index + 1}. {item.title}
              </li>
            ))}
          </ol>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{currentStep.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            {currentStep.id === "project" && (
              <>
                {projects.length > 0 ? (
                  <p className="text-sm">
                    Your project{" "}
                    <strong>{current?.name ?? "selected project"}</strong> is
                    ready.
                  </p>
                ) : (
                  <CreateProjectForm onCreated={setCreatedSecret} />
                )}
              </>
            )}

            {currentStep.id === "key" && (
              <>
                <p className="text-sm leading-6 text-muted-foreground">
                  This server write key authenticates telemetry from your
                  application. Keep it in a server environment variable, never
                  in a browser bundle.
                </p>
                {createdSecret ? (
                  <SecretAlert
                    secret={createdSecret}
                    label="Your new project write key is"
                  />
                ) : hasWriteKey ? (
                  <Alert>
                    <AlertTitle>Write key exists</AlertTitle>
                    <AlertDescription>
                      The full value is shown only when a key is created. You
                      can rotate or create another key later in Settings.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Create a project before continuing.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {currentStep.id === "install" && (
              <>
                <p className="text-sm leading-6 text-muted-foreground">
                  Install the published Node SDK and configure the API URL and
                  write key in the application server.
                </p>
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6">
                  {`npm i @flowmarkdev/node\n\nFLOWMARK_API_KEY=<write key>\nFLOWMARK_API_URL=${origin}`}
                </pre>
                <CopyButton
                  value={`npm i @flowmarkdev/node\n\nFLOWMARK_API_KEY=<write key>\nFLOWMARK_API_URL=${origin}`}
                  label="Copy setup"
                />
              </>
            )}

            {currentStep.id === "instrument" && (
              <>
                <p className="text-sm leading-6 text-muted-foreground">
                  Mark a real process that has meaningful work, operations,
                  progress, or a useful reported result.
                </p>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-4 text-xs leading-6">
                  {snippet}
                </pre>
                <CopyButton value={snippet} label="Copy coding-agent prompt" />
              </>
            )}

            {currentStep.id === "run" && (
              <div className="grid gap-4">
                <Alert>
                  <AlertTitle>
                    {hasRuns
                      ? "Your telemetry is arriving"
                      : "Report one execution"}
                  </AlertTitle>
                  <AlertDescription>
                    {hasRuns
                      ? "You can now finish setup and inspect the run in the dashboard."
                      : "After your application sends one execution, it will appear in the dashboard. You can finish setup now and return to it when the run arrives."}
                  </AlertDescription>
                </Alert>
                {hasRuns ? (
                  <p className="text-sm text-muted-foreground">
                    {snapshot.data?.metrics.totalRuns.toLocaleString()} runs
                    recorded in this project.
                  </p>
                ) : null}
              </div>
            )}

            {(advance.error || complete.error) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(advance.error ?? complete.error)?.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0 || advance.isPending || complete.isPending}
                onClick={() => setStep((value) => Math.max(0, value - 1))}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={
                  advance.isPending ||
                  complete.isPending ||
                  (currentStep.id === "project" && !current) ||
                  (currentStep.id === "key" && !hasWriteKey)
                }
                onClick={next}
              >
                {currentStep.id === "run" ? "Finish setup" : "Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export function OnboardingFlow(props: {
  readonly email: string
  readonly initialStep: string
}) {
  return (
    <ProjectProvider>
      <OnboardingContent {...props} />
    </ProjectProvider>
  )
}
