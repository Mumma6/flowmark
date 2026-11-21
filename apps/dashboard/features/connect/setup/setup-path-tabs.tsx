"use client"

import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@flowmark/ui"
import { ArrowUpRight } from "lucide-react"
import { CopyButton } from "../../shared/dashboard-components"
import { publicConfig } from "../../platform/config-public"
import type { SetupPath } from "./connect-setup-state"
import {
  manualWorkflowSnippet,
  npmInstallCommand,
  serverEnvironmentSnippet,
} from "./setup-instructions"

function SetupCode({
  title,
  value,
  copyLabel,
  onCopied,
}: {
  title: string
  value: string
  copyLabel: string
  onCopied?: () => void
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">{title}</p>
        <CopyButton value={value} label={copyLabel} onCopied={onCopied} />
      </div>
      <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6 whitespace-pre-wrap text-foreground">
        {value}
      </pre>
    </div>
  )
}

export function SetupPathTabs({
  origin,
  agentPrompt,
  compact = false,
  onCopied,
}: {
  origin: string
  agentPrompt: string
  compact?: boolean
  onCopied: (path: SetupPath) => void
}) {
  const envSnippet = serverEnvironmentSnippet(origin)

  return (
    <Tabs defaultValue="manual">
      <TabsList
        variant="line"
        aria-label="Instrumentation setup paths"
        className="h-auto w-full flex-wrap justify-start gap-1 border-b border-border pb-2 [&_[data-slot=tabs-trigger]]:after:bg-highlight"
      >
        <TabsTrigger value="manual">Set up with the SDK</TabsTrigger>
        <TabsTrigger value="agent">Set up with a coding agent</TabsTrigger>
      </TabsList>
      <TabsContent value="agent" className="mt-6 grid gap-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Copy this prompt into a coding agent that can read your repository. It
          should propose where to start and show the first change for your
          review before installing anything.
        </p>
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium">Set up with your AI agent</p>
            <CopyButton
              value={agentPrompt}
              label="Copy setup prompt"
              variant="default"
              onCopied={() => onCopied("agent")}
            />
          </div>
          <details className="text-xs leading-6 text-muted-foreground">
            <summary className="cursor-pointer">Preview setup prompt</summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6 whitespace-pre-wrap text-foreground">
              {agentPrompt}
            </pre>
          </details>
          <p className="text-xs leading-6 text-muted-foreground">
            Add the write key to your server environment yourself when the agent
            asks.
          </p>
        </div>
      </TabsContent>
      <TabsContent value="manual" className="mt-6 grid gap-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Start with one existing import, sync or job. This example uses a
          Next.js Route Handler or Server Action in the Node.js runtime. The
          Next.js adapter handles delivery after the request.
        </p>
        <SetupCode
          title="Install"
          value={npmInstallCommand()}
          copyLabel="Copy install"
          onCopied={() => onCopied("manual")}
        />
        <SetupCode
          title="Server environment"
          value={envSnippet}
          copyLabel="Copy env"
          onCopied={() => onCopied("manual")}
        />
        {!compact ? (
          <SetupCode
            title="First process example"
            value={manualWorkflowSnippet}
            copyLabel="Copy snippet"
            onCopied={() => onCopied("manual")}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href={new URL("/docs/nodejs", publicConfig.documentationUrl).href}
            >
              Set up a Node.js script or worker
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </a>
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  )
}
