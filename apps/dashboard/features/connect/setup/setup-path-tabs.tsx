"use client"

import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@flowmark/ui"
import { ArrowUpRight } from "lucide-react"
import { CopyButton } from "../../shared/dashboard-components"
import { publicConfig } from "../../platform/config-public"
import type { SetupPath } from "./connect-setup-state"
import {
  instrumentationGuideUrl,
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
  const manualSnippet = manualWorkflowSnippet(origin)
  const guideUrl = instrumentationGuideUrl(origin)

  return (
    <Tabs defaultValue="agent">
      <TabsList
        variant="line"
        aria-label="Instrumentation setup paths"
        className="h-auto w-full flex-wrap justify-start gap-1 border-b border-border pb-2 [&_[data-slot=tabs-trigger]]:after:bg-highlight"
      >
        <TabsTrigger value="agent">Cursor · recommended</TabsTrigger>
        <TabsTrigger value="manual">Manual SDK</TabsTrigger>
      </TabsList>
      <TabsContent value="agent" className="mt-6 grid gap-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Set the server environment yourself, then paste the prompt into
          Cursor. It reads the SDK docs and helps instrument one useful process.
        </p>
        <SetupCode
          title="Server environment · set this yourself"
          value={envSnippet}
          copyLabel="Copy environment template"
        />
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium">
              Your first process · Cursor prompt
            </p>
            <CopyButton
              value={agentPrompt}
              label="Copy instrumentation prompt"
              onCopied={() => onCopied("agent")}
            />
          </div>
          <details className="text-xs leading-6 text-muted-foreground">
            <summary className="cursor-pointer">
              Preview instrumentation prompt
            </summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6 whitespace-pre-wrap text-foreground">
              {agentPrompt}
            </pre>
          </details>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="justify-self-start"
        >
          <a href={guideUrl} target="_blank" rel="noreferrer">
            Open instrumentation guide
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
        </Button>
      </TabsContent>
      <TabsContent value="manual" className="mt-6 grid gap-4">
        <p className="text-sm leading-6 text-muted-foreground">
          No AI client required. Install the SDK, set your server environment,
          then add markers to one process your application already runs. For
          Next.js, use the Next.js adapter described in the instrumentation
          guide.
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
            value={manualSnippet}
            copyLabel="Copy snippet"
            onCopied={() => onCopied("manual")}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={guideUrl} target="_blank" rel="noreferrer">
              Open instrumentation guide
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={publicConfig.documentationUrl}>
              Open documentation
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </a>
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  )
}
