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
              ? "See your first process execution"
              : "Create your first project"}
        </CardTitle>
        <CardDescription>
          {hasRuns
            ? "Start with the reported result, then inspect the work behind it."
            : "Start with one useful process. Your AI agent can help you add the SDK; manual setup is always available."}
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
                    Run the process in your application, then return to Explore
                    to open its reported result.
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
                  {hasRuns
                    ? "Explore executions"
                    : "Instrument your application"}
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
