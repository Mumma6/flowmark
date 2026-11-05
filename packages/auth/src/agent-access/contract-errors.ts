import { Data } from "effect"

export class AgentAccessContractError extends Data.TaggedError(
  "AgentAccessContractError",
)<{
  readonly reason: string
}> {}
