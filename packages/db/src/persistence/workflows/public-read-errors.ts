import { Data } from "effect"

export class InvalidRunReadCursor extends Data.TaggedError(
  "InvalidRunReadCursor",
) {}
