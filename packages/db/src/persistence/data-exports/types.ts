import { Data } from "effect"
export class DataExportRejected extends Data.TaggedError("DataExportRejected")<{
  readonly reason:
    "Unavailable" | "TooManyRequests" | "OversizedRecord" | "InvalidCursor"
}> {}
