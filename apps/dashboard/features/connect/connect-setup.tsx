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
import { DataState, PageHeading } from "../shared/dashboard-components"
import type { ConnectSetupStage } from "./connect-setup-state"
import { firstRunPath } from "./first-run-evidence"
import { setupRecoveryCopy } from "./setup-instructions"
import { SetupPathTabs } from "./setup-path-tabs"
import { useConnectSetup } from "./use-connect-setup"
import { useProject } from "../projects/project-context"

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
        <CardTitle>Recovery</CardTitle>
        <CardDescription>
          Common setup mistakes stay actionable without claiming an agent
          connection or OAuth grant.
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
          {stage.runId ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="justify-self-start"
            >
              <Link href={firstRunPath(stage.runId)}>Open recorded run</Link>
            </Button>
          ) : null}
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
      <ConnectSetupStages stages={stages} />
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
        <ConnectRecovery
          apiOrigin={origin}
          projectName={current?.name ?? null}
        />
      ) : null}
    </div>
  )
}

export function ConnectPage() {
  const { current, projects } = useProject()
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title="Connect"
        description="Instrument the application you already own with a coding agent or manual SDK steps. Copied instructions, configured keys, and observed evidence stay separate — none of them register an OAuth client or connected agent."
      />
      {projects.length === 0 ? (
        <Alert>
          <AlertTitle>Create a project first</AlertTitle>
          <AlertDescription className="grid gap-3">
            <p>
              Projects own ingestion keys and recorded evidence. Create one in
              Settings before you configure an application.
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
            . Switch projects in the header when you change which application
            you are configuring.
          </p>
          <ConnectSetupPanel />
        </>
      )}
    </div>
  )
}
