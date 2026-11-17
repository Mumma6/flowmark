"use client"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import Link from "next/link"
import { DataState } from "../../shared/dashboard-components"
import { CreateProjectForm } from "../../projects/create-project-form"
import { useProject } from "../../projects/project-context"

/** A short route back into setup, rather than a second copy of every SDK step. */
export function GettingStartedChecklist({
  hasRuns,
  compact = false,
}: {
  hasRuns: boolean
  compact?: boolean
}) {
  const { current, pending, error, retry } = useProject()
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {hasRuns
            ? "Explore your process evidence"
            : current
              ? "Waiting for application data"
              : "Create your first project"}
        </CardTitle>
        <CardDescription>
          {hasRuns
            ? "Start with the reported result, then inspect the work behind it."
            : "Install and deploy the SDK when you are ready. Executions appear here when your application sends evidence."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataState pending={pending} error={error} retry={retry} />
        {!pending && !error && !current ? <CreateProjectForm /> : null}
        {current ? (
          <>
            <ol
              className="grid list-decimal gap-3 pl-5 text-sm leading-6 text-muted-foreground"
              aria-label="Getting started checklist"
            >
              {hasRuns ? (
                <>
                  <li>
                    Select a process in Explore to see its execution history.
                  </li>
                  <li>
                    Open an execution. Outcome shows reported results; Timeline
                    shows operations and failures.
                  </li>
                  <li>
                    Ask Cursor to investigate with Flowmark MCP and follow the
                    supporting Studio links.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    Save the ingestion key for <strong>{current.name}</strong>{" "}
                    in your application's server environment.
                  </li>
                  <li>
                    Copy the setup prompt into your AI agent to install the SDK
                    and instrument one process, or follow the manual SDK steps.
                  </li>
                  <li>
                    Deploy through your usual release process. When the
                    instrumented process runs and sends evidence, its executions
                    appear in Studio.
                  </li>
                </>
              )}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link
                  href={
                    hasRuns ? "/" : "/onboarding?mode=guide&step=instrument"
                  }
                >
                  {hasRuns ? "Explore executions" : "SDK setup instructions"}
                </Link>
              </Button>
              {!compact ? (
                <Button asChild variant="outline">
                  <Link href="/onboarding?mode=guide">Reopen setup guide</Link>
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
