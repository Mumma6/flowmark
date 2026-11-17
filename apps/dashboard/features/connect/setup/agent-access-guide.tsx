"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { CopyButton } from "../../shared/dashboard-components"
import { useAgentAccess } from "../access/use-agent-access"
import { AgentConnections } from "../connections/agent-connections"
import { CursorConnectionSetup } from "./cursor-connection-setup"

export function AgentAccessGuide() {
  const { intro, examples, handoffIntro, deployment } = useAgentAccess()
  return (
    <section
      id="agent-access"
      aria-labelledby="agent-access-heading"
      className="grid gap-4 scroll-mt-6"
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
      </div>
      <CursorConnectionSetup />
      <details className="grid gap-4">
        <summary className="cursor-pointer text-sm font-medium">
          Investigate with Cursor
        </summary>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Ask about the evidence</CardTitle>
            <CardDescription>
              Once your application reports a run, start with one outcome or
              failure.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {examples.map((example) => (
              <div key={example.id} className="grid gap-2">
                <h3 className="text-sm font-medium">{example.label}</h3>
                <p className="text-xs leading-6 text-muted-foreground">
                  {example.prompt}
                </p>
                <CopyButton value={example.prompt} label="Copy question" />
              </div>
            ))}
            {deployment.kind === "unavailable" ? (
              <CopyButton value={handoffIntro} label="Copy manual handoff" />
            ) : null}
          </CardContent>
        </Card>
      </details>
      {deployment.kind === "enabled" ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Manage connections and project access
          </summary>
          <div className="mt-4">
            <AgentConnections />
          </div>
        </details>
      ) : null}
    </section>
  )
}
