"use client"

import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@flowmark/ui"
import { ArrowUpRight } from "lucide-react"
import { CopyButton } from "../shared/dashboard-components"
import { publicConfig } from "../platform/config-public"
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
        <TabsTrigger value="agent">Coding agent</TabsTrigger>
        <TabsTrigger value="manual">Manual SDK</TabsTrigger>
      </TabsList>
      <TabsContent value="agent" className="mt-6 grid gap-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Copy one instruction into your coding workspace. The agent fetches the
          instrumentation guide from the API. Configure the write key in your
          server environment yourself. Copying does not connect or authorize an
          agent.
        </p>
        <SetupCode
          title="Instrumentation instruction"
          value={agentPrompt}
          copyLabel="Copy instruction"
          onCopied={() => onCopied("agent")}
        />
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
          Follow the SDK guide yourself: install the package, configure the
          server environment, then instrument one meaningful process.
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
