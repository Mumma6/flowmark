import { expect, it } from "vitest"
import {
  clearAgentAccessTransient,
  markAgentAccessCopied,
} from "../features/connect/agent-access-state"

it("clears local copy markers and tracks successful targets separately", () => {
  let state = markAgentAccessCopied(clearAgentAccessTransient(), {
    kind: "handoff-intro",
  })
  state = markAgentAccessCopied(state, {
    kind: "example-question",
    questionId: "explain-run",
  })
  state = markAgentAccessCopied(state, { kind: "client", client: "cursor" })
  expect(state.handoffIntroCopied).toBe(true)
  expect(state.exampleQuestionsCopied["explain-run"]).toBe(true)
  expect(state.clientGuidanceCopied.cursor).toBe(true)
  expect(clearAgentAccessTransient()).toEqual({
    handoffIntroCopied: false,
    exampleQuestionsCopied: {},
    clientGuidanceCopied: {},
  })
})
