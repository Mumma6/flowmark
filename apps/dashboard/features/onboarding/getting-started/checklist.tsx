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
            : "Start with one useful process. Cursor can help you add the SDK; manual setup is always available."}
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
                    Open Connect, add Flowmark to Cursor, sign in and approve{" "}
                    <strong>{current.name}</strong>. You can skip Cursor for
                    manual SDK setup.
                  </li>
                  <li>
                    Copy the instrumentation prompt or follow the SDK steps.
                    Save your project write key in your application's server
                    environment.
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
                <Link href={hasRuns ? "/" : "/connect"}>
                  {hasRuns ? "Explore executions" : "Set up with Cursor or SDK"}
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
