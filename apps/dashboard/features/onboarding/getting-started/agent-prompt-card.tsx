"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { useApiOrigin } from "../../platform/runtime-config"
import { SetupPathTabs } from "../../connect/setup/setup-path-tabs"
import { flowmarkAgentPrompt } from "../agent-prompt"

export function AgentPromptBody() {
  const origin = useApiOrigin()
  return (
    <SetupPathTabs
      origin={origin}
      agentPrompt={flowmarkAgentPrompt(origin)}
      compact
      onCopied={() => undefined}
    />
  )
}

export function AgentPromptCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coding agent</CardTitle>
        <CardDescription>
          Copy one instruction. The agent fetches the instrumentation guide from
          the API and follows it. The write key stays in the server environment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AgentPromptBody />
      </CardContent>
    </Card>
  )
}
