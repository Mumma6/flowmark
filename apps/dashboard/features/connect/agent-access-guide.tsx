"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flowmark/ui"
import { ArrowUpRight, Check } from "lucide-react"
import Link from "next/link"
import { CopyButton } from "../shared/dashboard-components"
import { publicConfig } from "../platform/config-public"
import type { AgentClientGuide } from "./agent-access-guidance"
import type { RemoteAgentAccessDeployment } from "./agent-access-capability"
import { useAgentAccess } from "./use-agent-access"
import { useAgentReadVerification } from "./use-agent-read-verification"
import { AgentConnections } from "./agent-connections"
import type { AgentReadVerification } from "./agent-access-verification"

function SetupCode({
  title,
  value,
  copyLabel,
  copied,
  onCopied,
  onCopyFailed,
}: {
  title: string
  value: string
  copyLabel: string
  copied?: boolean
  onCopied?: () => void
  onCopyFailed?: () => void
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium">{title}</p>
          {copied ? (
            <Badge variant="success" className="text-[10px]">
              <span className="inline-flex items-center gap-1">
                <Check aria-hidden="true" className="size-3" />
                Copied locally
              </span>
            </Badge>
          ) : null}
        </div>
        <CopyButton
          value={value}
          label={copyLabel}
          onCopied={onCopied}
          onCopyFailed={onCopyFailed}
        />
      </div>
      <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6 whitespace-pre-wrap text-foreground">
        {value}
      </pre>
    </div>
  )
}

function clientGuidanceText(guide: AgentClientGuide): string {
  return [
    guide.summary,
    "",
    ...guide.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    guide.pasteHint,
  ].join("\n")
}

function RemoteAccessStatus({
  deployment,
}: {
  deployment: RemoteAgentAccessDeployment
}) {
  if (deployment.kind === "enabled") {
    return (
      <Alert>
        <AlertTitle>Remote read endpoint</AlertTitle>
        <AlertDescription className="grid gap-2">
          <p>
            MCP endpoint for this environment:{" "}
            <code className="text-foreground">{deployment.mcpUrl}</code>
          </p>
          <p className="text-sm">
            Register it in your client and approve projects in Studio. The
            endpoint alone is not authorization. Vendor client compatibility is
            not established; the tested path is the reference HTTP client.
          </p>
        </AlertDescription>
      </Alert>
    )
  }
  if (deployment.kind === "unavailable") {
    return (
      <Alert>
        <AlertTitle>{deployment.headline}</AlertTitle>
        <AlertDescription>{deployment.detail}</AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert>
      <AlertTitle>{deployment.headline}</AlertTitle>
      <AlertDescription className="grid gap-3 text-sm leading-6">
        <p>{deployment.detail}</p>
        <p>
          There is no connection list, consent flow, or verified remote state on
          this page yet. Manual Studio navigation and copy actions below are the
          supported path.
        </p>
      </AlertDescription>
    </Alert>
  )
}

function verificationCopy(verification: AgentReadVerification) {
  if (verification._tag === "Verified" && verification.runs === "none") {
    return "Access verified — no runs recorded yet"
  }
  if (verification._tag === "Verified") {
    return "Access verified"
  }
  if (verification._tag === "Granted") {
    return "Authorization granted. No authenticated read has been recorded."
  }
  if (verification._tag === "WrongProject") {
    return "This account has no agent grant for the current project. Approve it again or switch project."
  }
  if (verification._tag === "Denied") {
    return "The read was rejected. Sign in with the account that owns the project and try again."
  }
  if (verification._tag === "Unavailable") {
    return "The access check is temporarily unavailable. Retry shortly."
  }
  if (verification._tag === "UnsupportedClient") {
    return "This client is not one of the supported setup paths."
  }
  if (verification._tag === "CopyFailed") {
    return "The last copy failed. Retry it. A failed copy is not access."
  }
  if (verification._tag === "Copied") {
    return "Configuration was copied on this page. That does not grant access."
  }
  if (verification._tag === "Disabled") {
    return "Remote read access is not enabled. Copied Studio text stays a manual handoff."
  }
  return "Access has not been checked yet."
}

function AccessCheck({
  verification,
  copied,
  copyFailed,
}: {
  verification: AgentReadVerification
  copied: boolean
  copyFailed: boolean
}) {
  const verified = verification._tag === "Verified"
  return (
    <Card>
      <CardHeader>
        <CardTitle>Access check</CardTitle>
        <CardDescription>
          Copied configuration, an authorization grant, and an authenticated
          read stay separate. None of them means an agent process is running.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm leading-6">
        <p>Configuration copied: {copied ? "Yes, on this page" : "No"}</p>
        {copyFailed ? <p>The last copy failed. Retry the copy.</p> : null}
        <p>{verificationCopy(verification)}</p>
        {verified ? (
          <Badge variant="success" className="justify-self-start">
            {verificationCopy(verification)}
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ClientGuidancePanel({
  guide,
  copied,
  onCopied,
  onCopyFailed,
}: {
  guide: AgentClientGuide
  copied: boolean
  onCopied: () => void
  onCopyFailed: () => void
}) {
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-6 text-muted-foreground">{guide.summary}</p>
      <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-muted-foreground">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <SetupCode
        title="Copy manual guidance"
        value={clientGuidanceText(guide)}
        copyLabel="Copy guidance"
        copied={copied}
        onCopied={onCopied}
        onCopyFailed={onCopyFailed}
      />
      <p className="text-sm leading-6 text-muted-foreground">
        {guide.pasteHint}
      </p>
    </div>
  )
}

export function AgentAccessGuide() {
  const access = useAgentAccess()
  const {
    intro,
    clients,
    examples,
    handoffIntro,
    transient,
    markCopied,
    markCopyFailed,
    studioOrigin,
    deployment,
    current,
  } = access
  const verification = useAgentReadVerification({
    deployment,
    projectId: current?.id,
    transient,
    clientSupported: true,
  })
  const configurationCopied =
    transient.handoffIntroCopied ||
    Object.values(transient.exampleQuestionsCopied).some(Boolean) ||
    Object.values(transient.clientGuidanceCopied).some(Boolean)

  return (
    <section
      id="agent-access"
      aria-labelledby="agent-access-heading"
      className="grid gap-6 scroll-mt-6"
    >
      <div className="grid gap-2">
        <h2
          id="agent-access-heading"
          className="text-lg font-semibold tracking-tight"
        >
          {intro.title}
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {intro.body}
        </p>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {intro.separation}
        </p>
      </div>
      <RemoteAccessStatus deployment={deployment} />
      <AccessCheck
        verification={verification}
        copied={configurationCopied}
        copyFailed={transient.copyFailed}
      />
      {deployment.kind === "enabled" ? <AgentConnections /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Manual evidence handoff</CardTitle>
          <CardDescription>
            Open Studio, copy factual run summaries, then paste them into your
            agent. No OAuth or model call happens from this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/explore">Open Explore</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/runs">Open Runs</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={publicConfig.documentationUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open documentation
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </a>
            </Button>
          </div>
          <SetupCode
            title="Handoff checklist"
            value={handoffIntro}
            copyLabel="Copy checklist"
            copied={transient.handoffIntroCopied}
            onCopied={() => markCopied({ kind: "handoff-intro" })}
            onCopyFailed={markCopyFailed}
          />
          {studioOrigin ? (
            <p className="text-xs text-muted-foreground">
              Links use your current Studio origin ({studioOrigin}). Switch
              projects in the header before copying run-specific text.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Example questions</CardTitle>
          <CardDescription>
            Starter prompts for manual paste. Replace placeholders with run
            links and UTC windows from Studio when you have them.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {examples.map((example) => (
            <SetupCode
              key={example.id}
              title={example.label}
              value={example.prompt}
              copyLabel="Copy question"
              copied={transient.exampleQuestionsCopied[example.id] === true}
              onCopied={() =>
                markCopied({
                  kind: "example-question",
                  questionId: example.id,
                })
              }
              onCopyFailed={markCopyFailed}
            />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Choose your client</CardTitle>
          <CardDescription>
            {deployment.kind === "enabled"
              ? "Use the endpoint for this environment. Copying it does not write your client configuration or grant access."
              : "Four manual paths without remote MCP. Copy guidance into the surface you already use; nothing here registers OAuth or stores a connection."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="codex">
            <TabsList
              variant="line"
              aria-label="Agent client manual guidance"
              className="h-auto w-full flex-wrap justify-start gap-1 border-b border-border pb-2 [&_[data-slot=tabs-trigger]]:after:bg-highlight"
            >
              {clients.map((client) => (
                <TabsTrigger key={client.id} value={client.id}>
                  {client.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {clients.map((client) => (
              <TabsContent key={client.id} value={client.id} className="mt-6">
                <ClientGuidancePanel
                  guide={client}
                  copied={transient.clientGuidanceCopied[client.id] === true}
                  onCopied={() =>
                    markCopied({ kind: "client", client: client.id })
                  }
                  onCopyFailed={markCopyFailed}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </section>
  )
}
