import type { AgentClientId } from "./agent-access-guidance"

export type AgentAccessCopyKind = "handoff-intro"

export type AgentAccessTransient = {
  readonly handoffIntroCopied: boolean
  readonly exampleQuestionsCopied: Partial<Record<string, boolean>>
  readonly clientGuidanceCopied: Partial<Record<AgentClientId, boolean>>
  readonly copyFailed: boolean
}

export function initialAgentAccessTransient(): AgentAccessTransient {
  return {
    handoffIntroCopied: false,
    exampleQuestionsCopied: {},
    clientGuidanceCopied: {},
    copyFailed: false,
  }
}

export function clearAgentAccessTransient(): AgentAccessTransient {
  return initialAgentAccessTransient()
}

export function markAgentAccessCopied(
  state: AgentAccessTransient,
  target:
    | { readonly kind: AgentAccessCopyKind }
    | { readonly kind: "example-question"; readonly questionId: string }
    | { readonly kind: "client"; readonly client: AgentClientId },
): AgentAccessTransient {
  if (target.kind === "handoff-intro") {
    return { ...state, handoffIntroCopied: true, copyFailed: false }
  }
  if (target.kind === "example-question") {
    return {
      ...state,
      copyFailed: false,
      exampleQuestionsCopied: {
        ...state.exampleQuestionsCopied,
        [target.questionId]: true,
      },
    }
  }
  return {
    ...state,
    copyFailed: false,
    clientGuidanceCopied: {
      ...state.clientGuidanceCopied,
      [target.client]: true,
    },
  }
}

export function markAgentAccessCopyFailed(
  state: AgentAccessTransient,
): AgentAccessTransient {
  return { ...state, copyFailed: true }
}
