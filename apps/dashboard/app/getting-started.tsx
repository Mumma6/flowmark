"use client"

import { useEffect, useState } from "react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import Link from "next/link"
import { flowmarkAgentPrompt, flowmarkApiOrigin } from "./agent-prompt"

const storageKey = "flowmark.dashboard.onboarding.dismissed"

const steps = [
  {
    title: "What you can do here",
    description:
      "The dashboard reads evidence your application chose to report. It does not run the process.",
  },
  {
    title: "Create a write key",
    description:
      "Applications write with a project key. Dashboard sign-in is a different credential.",
  },
  {
    title: "Paste a prompt into your coding agent",
    description:
      "The prompt covers install, config, and where Flowmark is worth adding.",
  },
] as const

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
      {copied ? "Copied" : "Copy prompt"}
    </Button>
  )
}

function AgentPromptBody() {
  const prompt = flowmarkAgentPrompt(flowmarkApiOrigin())
  return (
    <div className="grid gap-3">
      <p className="text-sm leading-6 text-muted-foreground">
        Put the write key in the server environment yourself. This prompt does
        not contain it. Install with{" "}
        <code>npm i @flowmarkdev/node@alpha</code>.
      </p>
      <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6 whitespace-pre-wrap">
        {prompt}
      </pre>
      <CopyButton value={prompt} />
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

function DashboardStep() {
  return (
    <ul className="grid gap-3 text-sm leading-6 text-muted-foreground">
      <li>
        <strong className="font-medium text-foreground">Overview</strong>{" "}
        shows volume, success rate, duration, week-over-week change, slow
        operations, and failure codes.
      </li>
      <li>
        <strong className="font-medium text-foreground">Workflows</strong>{" "}
        groups executions under one process name, such as{" "}
        <code>invoice.import</code>.
      </li>
      <li>
        <strong className="font-medium text-foreground">Runs</strong> opens
        one execution: timeline, operations, last reported progress, handled
        and unhandled errors, context, result highlights, related runs, and
        duration against recent peers.
      </li>
      <li>
        Completed means the application reported completion. It does not mean
        every record succeeded. Progress is the last snapshot, not proof the
        run is still active.
      </li>
    </ul>
  )
}

function KeyStep() {
  const origin = flowmarkApiOrigin()
  return (
    <div className="grid gap-4 text-sm leading-6 text-muted-foreground">
      <p>
        In{" "}
        <Link href="/settings" className="text-primary underline">
          Settings
        </Link>
        , create a server write key. Store it where the server process can
        read it. Flowmark shows the full key only once.
      </p>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6">
        {`FLOWMARK_API_KEY=<write key>
FLOWMARK_API_URL=${origin}`}
      </pre>
      <p>
        <code>FLOWMARK_API_URL</code> is the API origin, not{" "}
        <code>/v1/events</code>. Keep the write key off <code>NEXT_PUBLIC_</code>{" "}
        variables and out of the browser. A browser key is a separate public
        credential with allowed origins.
      </p>
    </div>
  )
}

export function OnboardingGuide() {
  const [open, setOpen] = useState<boolean | null>(null)
  const [step, setStep] = useState(0)
  useEffect(() => {
    setOpen(window.localStorage.getItem(storageKey) !== "1")
  }, [])
  if (open === null) {
    return null
  }
  if (!open) {
    return (
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setStep(0)
            setOpen(true)
          }}
        >
          Getting started
        </Button>
      </div>
    )
  }
  const dismiss = () => {
    window.localStorage.setItem(storageKey, "1")
    setOpen(false)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>
          A short guide to the dashboard, a write key, and a prompt for your
          coding agent. Step {step + 1} of {steps.length}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <ol className="flex flex-wrap gap-2" aria-label="Guide steps">
          {steps.map((item, index) => (
            <li key={item.title}>
              <Button
                type="button"
                size="sm"
                variant={index === step ? "secondary" : "ghost"}
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
              >
                {index + 1}. {item.title}
              </Button>
            </li>
          ))}
        </ol>
        <div className="grid gap-3">
          <h2 className="text-lg font-medium tracking-tight">
            {steps[step]?.title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {steps[step]?.description}
          </p>
          {step === 0 ? <DashboardStep /> : null}
          {step === 1 ? <KeyStep /> : null}
          {step === 2 ? <AgentPromptBody /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={() => setStep((current) => current + 1)}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={dismiss}>
              Done
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
