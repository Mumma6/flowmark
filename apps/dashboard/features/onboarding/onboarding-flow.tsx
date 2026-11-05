"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
  FlowmarkMark,
} from "@flowmark/ui"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Code2,
  KeyRound,
  Radio,
  Workflow,
} from "lucide-react"
import { useEffect, useRef } from "react"
import Link from "next/link"
import { DataState } from "../shared/dashboard-components"
import { publicConfig } from "../platform/config-public"
import { RuntimeConfigProvider } from "../platform/runtime-config"
import { CreateProjectForm, SecretAlert } from "../projects/create-project-form"
import { ProjectProvider, useProject } from "../projects/project-context"
import { steps } from "./steps"
import { useOnboarding } from "./use-onboarding"

const guidance = {
  project: {
    icon: Workflow,
    description:
      "Give your application a home. A project keeps its evidence, access and ingestion keys together.",
    note: "One application, one context.",
    detail:
      "You can create more projects later. Start with the application and environment you want to understand first.",
  },
  key: {
    icon: KeyRound,
    description:
      "Save the credential your application uses to send evidence. Your Studio account and your write key have different jobs.",
    note: "Your key stays on your server.",
    detail:
      "Store it in your application's server environment. Keep it out of browser bundles, Git, agent prompts and chat messages.",
  },
  install: {
    icon: Code2,
    description:
      "Add the TypeScript SDK to the application you already own. Keep your runtime, framework and business logic.",
    note: "Built around your application.",
    detail:
      "Use the Node client for workers and servers, or the Next.js adapter for request-lifecycle delivery. The API URL is the origin, without /v1/events.",
  },
  instrument: {
    icon: Workflow,
    description:
      "Choose one process worth understanding. Use your coding agent to add meaningful context and reported outcomes.",
    note: "Give the agent guidance, not secrets.",
    detail:
      "These instructions work with Codex, Cursor, Claude Code or your coding agent. Copying a prompt does not connect or authorize an agent.",
  },
  run: {
    icon: Radio,
    description:
      "Run your application normally, then follow the execution evidence into Studio.",
    note: "Completion is one piece of evidence.",
    detail:
      "Reported results and expected confirmations tell you more. A completed execution does not prove every record succeeded.",
  },
} as const

function SetupCode({ title, value }: { title: string; value: string }) {
  return (
    <CodeBlock className="min-w-0 border-border bg-background/70">
      <CodeBlockHeader className="px-4">
        <CodeBlockTitle>{title}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={value} className="h-8 text-[10px]" />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent
        tabIndex={0}
        className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 text-[11px] leading-7"
      >
        {value}
      </CodeBlockContent>
    </CodeBlock>
  )
}

function OnboardingContent({
  email,
  initialStep,
  reviewMode = false,
}: {
  email: string
  initialStep: string
  reviewMode?: boolean
}) {
  const {
    current,
    projects,
    snapshot,
    keys,
    origin,
    step,
    setStep,
    createdSecret,
    setCreatedSecret,
    currentStep,
    hasWriteKey,
    hasRuns,
    advance,
    complete,
    snippet,
    next,
  } = useOnboarding(initialStep, reviewMode)
  const projectState = useProject()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  useEffect(() => {
    if (previousStep.current !== step) {
      titleRef.current?.focus()
      previousStep.current = step
    }
  }, [step])
  const currentGuidance = guidance[currentStep.id]
  const StepIcon = currentGuidance.icon
  const busy = advance.isPending || complete.isPending
  const blocked =
    projectState.pending ||
    Boolean(projectState.error) ||
    busy ||
    (currentStep.id === "project" && !current) ||
    (currentStep.id === "key" &&
      (!hasWriteKey || keys.isPending || Boolean(keys.error)))

  return (
    <main className="relative isolate min-h-screen bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.05),transparent_70%)]"
      />
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-2.5">
            <FlowmarkMark className="size-6 text-primary" />
            <span className="text-sm font-semibold tracking-tight">
              flowmark<span className="text-primary">.</span>
            </span>
            <span aria-hidden="true" className="mx-2 text-border">
              /
            </span>
            <span className="text-xs text-muted-foreground">
              {reviewMode ? "Setup guide" : "Studio setup"}
            </span>
          </div>
          {reviewMode ? (
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft aria-hidden="true" className="size-3" />
              Back to Studio
            </Link>
          ) : (
            <a
              href={publicConfig.documentationUrl}
              className="inline-flex min-h-9 items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Documentation
              <ArrowUpRight aria-hidden="true" className="size-3" />
            </a>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="mb-10 max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
            From application to understanding
          </p>
          <h1 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.045em] sm:text-[42px]">
            {reviewMode ? "Keep your application" : "Make your first process"}
            <br className="hidden sm:block" /> understandable.
          </h1>
          <p className="mt-4 max-w-lg text-xs leading-7 text-muted-foreground">
            A few deliberate signals are enough to begin. Set up your
            application, report one execution, and explore what happened.
          </p>
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
          <aside className="lg:sticky lg:top-28">
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={step + 1}
              aria-valuetext={`Step ${step + 1} of ${steps.length}: ${currentStep.title}`}
              className="mb-5 grid grid-cols-5 gap-1.5"
            >
              {steps.map((item, index) => (
                <span
                  key={item.id}
                  aria-hidden="true"
                  className={`h-1 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`}
                />
              ))}
            </div>
            <ol aria-label="Setup steps" className="hidden gap-1 lg:grid">
              {steps.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={index > step || busy}
                    onClick={() => setStep(index)}
                    aria-current={index === step ? "step" : undefined}
                    className={`flex min-h-10 w-full items-center gap-3 rounded-lg border px-3 text-left text-xs ${index === step ? "border-primary/20 bg-primary/5 text-foreground" : "border-transparent text-muted-foreground disabled:opacity-60"}`}
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[9px] ${index <= step ? "border-primary/30 text-primary" : "border-border"}`}
                    >
                      {index < step ? (
                        <Check aria-hidden="true" className="size-3" />
                      ) : (
                        `0${index + 1}`
                      )}
                    </span>
                    {item.title}
                  </button>
                </li>
              ))}
            </ol>
            <p className="font-mono text-[10px] text-muted-foreground lg:mt-6">
              Step {step + 1} of {steps.length}
              <span className="ml-2 lg:hidden">· {currentStep.title}</span>
            </p>
            <p className="mt-8 hidden break-all border-t border-border pt-5 text-[10px] leading-6 text-muted-foreground lg:block">
              Signed in as
              <br />
              <span className="text-foreground/80">{email}</span>
            </p>
          </aside>

          <section
            aria-labelledby="setup-step-title"
            className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-[0_20px_80px_-50px_hsl(var(--primary)/0.15)]"
          >
            <div className="border-b border-border px-5 py-6 sm:px-8 sm:py-7">
              <span className="mb-5 grid size-10 place-items-center rounded-xl border border-primary/20 bg-primary/5 text-primary">
                <StepIcon aria-hidden="true" className="size-4" />
              </span>
              <h2
                id="setup-step-title"
                ref={titleRef}
                tabIndex={-1}
                className="text-xl font-medium tracking-tight sm:text-2xl"
              >
                {currentStep.title}
              </h2>
              <p className="mt-3 max-w-xl text-xs leading-7 text-muted-foreground">
                {currentGuidance.description}
              </p>
            </div>
            <div className="grid min-w-0 gap-6 px-5 py-6 sm:px-8 sm:py-7">
              <DataState
                pending={projectState.pending}
                error={projectState.error}
                retry={projectState.retry}
              />
              {!projectState.pending &&
              !projectState.error &&
              currentStep.id === "project" ? (
                projects.length > 0 ? (
                  <div className="flex items-start gap-3 rounded-lg border border-primary/15 bg-primary/5 p-4">
                    <CheckCheck
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {current?.name ?? "Selecting your project…"}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-muted-foreground">
                        Your project is ready. Continue to configure your
                        application.
                      </p>
                    </div>
                  </div>
                ) : (
                  <CreateProjectForm onCreated={setCreatedSecret} />
                )
              ) : null}
              {currentStep.id === "key" ? (
                <>
                  <DataState
                    pending={keys.isPending}
                    error={keys.error}
                    retry={() => void keys.refetch()}
                  />
                  {createdSecret ? (
                    <SecretAlert
                      secret={createdSecret}
                      label="Your new project write key is"
                    />
                  ) : !keys.isPending && !keys.error && hasWriteKey ? (
                    <Alert>
                      <AlertTitle>Write key created</AlertTitle>
                      <AlertDescription>
                        The full value is shown only once. Use the key you
                        saved, or create another in Studio Settings after setup.
                      </AlertDescription>
                    </Alert>
                  ) : !keys.isPending && !keys.error ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Go back and create a project before continuing.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </>
              ) : null}
              {currentStep.id === "install" ? (
                <div className="grid gap-5">
                  <SetupCode title="Terminal" value="npm i @flowmarkdev/node" />
                  <SetupCode
                    title="Server environment"
                    value={`FLOWMARK_API_KEY=<write key>\nFLOWMARK_API_URL=${origin}`}
                  />
                </div>
              ) : null}
              {currentStep.id === "instrument" ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-medium">
                      Set up with your coding agent
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      Codex · Cursor · Claude Code
                    </span>
                  </div>
                  <p className="text-xs leading-7 text-muted-foreground">
                    Paste this into your coding workspace. The agent fetches the
                    instrumentation guide from the API. Configure the write
                    key in your server environment yourself.
                  </p>
                  <SetupCode
                    title="Instrumentation instructions"
                    value={snippet}
                  />
                </div>
              ) : null}
              {currentStep.id === "run" ? (
                <div className="grid gap-4">
                  <DataState
                    pending={snapshot.isPending}
                    error={snapshot.error}
                    retry={() => void snapshot.refetch()}
                  />
                  {!snapshot.isPending && !snapshot.error ? (
                    <div
                      className={`rounded-xl border p-5 sm:p-6 ${hasRuns ? "border-primary/25 bg-primary/5" : "border-border bg-background/40"}`}
                    >
                      <span className="mb-4 grid size-10 place-items-center rounded-full border border-border">
                        {hasRuns ? (
                          <Check
                            aria-hidden="true"
                            className="size-4 text-primary"
                          />
                        ) : (
                          <Radio
                            aria-hidden="true"
                            className="size-4 text-muted-foreground"
                          />
                        )}
                      </span>
                      <h3 className="text-base font-medium">
                        {hasRuns
                          ? "Your application is reporting evidence."
                          : "Ready for your first execution."}
                      </h3>
                      <p className="mt-3 text-xs leading-7 text-muted-foreground">
                        {hasRuns
                          ? `${snapshot.data?.metrics.totalRuns.toLocaleString()} runs recorded in this project. Open Studio to explore the supporting evidence.`
                          : "Run the process in your application. Evidence appears after the API receives it. You can finish setup now and return when it arrives."}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="border-l border-primary/25 pl-4">
                <p className="text-[11px] font-medium">
                  {currentGuidance.note}
                </p>
                <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                  {currentGuidance.detail}
                </p>
              </div>
              {advance.error || complete.error ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {(advance.error ?? complete.error)?.message}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/20 px-5 py-4 sm:px-8">
              <Button
                variant="ghost"
                disabled={step === 0 || busy}
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                className="h-9 text-xs"
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" />
                Back
              </Button>
              <Button
                disabled={blocked}
                onClick={next}
                className="h-9 px-4 text-xs"
              >
                {busy
                  ? "Saving…"
                  : currentStep.id === "run"
                    ? hasRuns
                      ? "Open Studio"
                      : "Finish setup"
                    : "Continue"}
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export function OnboardingFlow(props: {
  readonly apiOrigin: string
  readonly email: string
  readonly initialStep: string
  readonly reviewMode?: boolean
}) {
  return (
    <RuntimeConfigProvider apiOrigin={props.apiOrigin}>
      <ProjectProvider>
        <OnboardingContent {...props} />
      </ProjectProvider>
    </RuntimeConfigProvider>
  )
}
