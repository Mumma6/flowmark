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
} from "@flowmark/ui"
import { Check } from "lucide-react"
import Link from "next/link"
import { DataState, PageHeading } from "../../shared/dashboard-components"
import { projectListState } from "../../projects/project-list-state"
import type { ConnectSetupStage } from "./connect-setup-state"
import { setupRecoveryCopy } from "./setup-instructions"
import { connectPageDescription } from "../access/agent-access-guidance"
import { AgentAccessGuide } from "./agent-access-guide"
import { SetupPathTabs } from "./setup-path-tabs"
import { useConnectSetup } from "./use-connect-setup"
import { useProject } from "../../projects/project-context"

function ConnectRecovery({
  apiOrigin,
  projectName,
}: {
  apiOrigin: string
  projectName: string | null
}) {
  const recovery = setupRecoveryCopy(apiOrigin, projectName)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Application setup help</CardTitle>
        <CardDescription>
          Check the write key, selected project and API URL if evidence is
          missing.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm leading-6 text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Copy failed</p>
          <p>{recovery.copyFailure}</p>
        </div>
        <div>
          <p className="font-medium text-foreground">Lost the write key</p>
          <p>{recovery.lostKey}</p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href="/settings?section=keys">Open ingestion keys</Link>
          </Button>
        </div>
        <div>
          <p className="font-medium text-foreground">Wrong project</p>
          <p>{recovery.wrongProject}</p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href="/settings?section=projects">Review projects</Link>
          </Button>
        </div>
        <div>
          <p className="font-medium text-foreground">Wrong API origin</p>
          <p>{recovery.wrongOrigin}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ConnectSetupStages({
  stages,
}: {
  stages: readonly ConnectSetupStage[]
}) {
  return (
    <ol className="grid gap-3" aria-label="Setup progress">
      {stages.map((stage) => (
        <li
          key={stage.id}
          className="grid gap-2 rounded-lg border border-border p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={stage.complete ? "success" : "secondary"}>
              {stage.complete ? (
                <span className="inline-flex items-center gap-1">
                  <Check aria-hidden="true" className="size-3" />
                  {stage.label}
                </span>
              ) : (
                stage.label
              )}
            </Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {stage.detail}
          </p>
        </li>
      ))}
    </ol>
  )
}

export function ConnectSetupPanel({ compact = false }: { compact?: boolean }) {
  const setup = useConnectSetup()
  const {
    origin,
    current,
    keys,
    hasWriteKey,
    agentPrompt,
    markCopied,
    stages,
  } = setup

  return (
    <div className="grid gap-6">
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Application setup progress
        </summary>
        <div className="mt-4">
          <ConnectSetupStages stages={stages} />
        </div>
      </details>
      <DataState
        pending={keys.isPending}
        error={keys.error}
        retry={() => void keys.refetch()}
      />
      {!keys.isPending && !keys.error && !hasWriteKey ? (
        <Alert>
          <AlertTitle>Write key required</AlertTitle>
          <AlertDescription className="grid gap-3">
            <p>
              Create or recover a server write key for{" "}
              <strong>{current?.name ?? "this project"}</strong> before your
              application can authenticate.
            </p>
            <Button asChild size="sm" className="justify-self-start">
              <Link href="/settings?section=keys">Open ingestion keys</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <SetupPathTabs
        origin={origin}
        agentPrompt={agentPrompt}
        compact={compact}
        onCopied={markCopied}
      />
      {!compact ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Troubleshoot application setup
          </summary>
          <div className="mt-4">
            <ConnectRecovery
              apiOrigin={origin}
              projectName={current?.name ?? null}
            />
          </div>
        </details>
      ) : null}
    </div>
  )
}

export function ConnectPage() {
  const { current, projects, pending, error, retry } = useProject()
  const list = projectListState({
    pending,
    failed: error !== null,
    count: projects.length,
  })
  return (
    <div className="grid min-w-0 gap-5 text-xs [&_h1]:text-2xl [&_h2]:text-base [&_h3]:text-xs [&_p]:text-xs [&_p]:leading-5 [&_li]:text-xs [&_li]:leading-5 [&_summary]:text-xs [&_pre]:text-[11px] [&_pre]:leading-5 [&_button]:h-8 [&_button]:min-h-8 [&_button]:px-3 [&_button]:text-[11px] [&_a.inline-flex]:h-8 [&_a.inline-flex]:min-h-8 [&_a.inline-flex]:text-[11px]">
      <PageHeading title="Connect" description={connectPageDescription()} />
      {list === "unavailable" || list === "pending" ? (
        <DataState
          pending={list === "pending"}
          error={list === "unavailable" ? error : null}
          retry={retry}
        />
      ) : projects.length === 0 ? (
        <Alert>
          <AlertTitle>Create a project first</AlertTitle>
          <AlertDescription className="grid gap-3">
            <p>
              Create a project in Settings, then choose which evidence Cursor
              can read.
            </p>
            <Button asChild size="sm" className="justify-self-start">
              <Link href="/settings?section=projects">Go to Projects</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Active project:{" "}
            <strong className="text-foreground">
              {current?.name ?? "Selected"}
            </strong>
            .
          </p>
          <div className="grid gap-6">
            <AgentAccessGuide />
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Need to instrument your application first?
              </summary>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Use the{" "}
                <Link
                  href="/onboarding?mode=guide&step=instrument"
                  className="text-primary underline underline-offset-4"
                >
                  SDK setup guide
                </Link>{" "}
                to copy an AI setup prompt or follow the manual steps. SDK
                installation works independently of MCP.
              </p>
            </details>
          </div>
        </>
      )}
    </div>
  )
}
