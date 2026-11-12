import { Data } from "effect"

export class DefinitionImportRejected extends Data.TaggedError(
  "DefinitionImportRejected",
)<{
  readonly reason:
    "Unauthorized" | "Stale" | "Conflict" | "ProtectedSearchField"
}> {}
