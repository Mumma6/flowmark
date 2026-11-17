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
import { useProject } from "../../projects/project-context"
import { flowmarkAgentPrompt } from "../agent-prompt"

export function AgentPromptBody() {
  const origin = useApiOrigin()
  const { current } = useProject()
  return (
    <SetupPathTabs
      origin={origin}
      agentPrompt={flowmarkAgentPrompt(origin, current)}
      compact
      onCopied={() => undefined}
    />
  )
}

export function AgentPromptCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up with your AI agent</CardTitle>
        <CardDescription>
          Copy the prompt into your AI agent to instrument one process. Keep the
          write key in your server environment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AgentPromptBody />
      </CardContent>
    </Card>
  )
}
