import { Data } from "effect"

export class CommandConfigurationError extends Data.TaggedError(
  "CommandConfigurationError",
)<{
  readonly reason: string
}> {}
