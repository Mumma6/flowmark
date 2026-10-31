import { Schema } from "effect"

export type AppendDisposition =
  "recorded" | "duplicate" | "ignored" | "conflict"
/** Older accepting servers omit disposition; do not infer their terminal policy. */
export const IngestionReceiptSchema = Schema.Struct({
  accepted: Schema.Boolean,
  disposition: Schema.optional(
    Schema.Literals(["recorded", "duplicate", "ignored"]),
  ),
}).check(
  Schema.makeFilter(
    (receipt) =>
      receipt.disposition === undefined ||
      receipt.accepted === (receipt.disposition !== "ignored"),
  ),
)
