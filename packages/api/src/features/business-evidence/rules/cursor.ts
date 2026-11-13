import { createHash } from "node:crypto"
import { Effect, Schema, Result } from "effect"
import { InvalidInput } from "../../../errors.js"
const Cursor = Schema.Struct({
  projectId: Schema.String,
  revision: Schema.Number,
  fingerprint: Schema.String,
  inner: Schema.String,
})
export const queryFingerprint = (input: unknown) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex")
export const encodeBusinessCursor = (
  projectId: string,
  revision: number,
  fingerprint: string,
  inner: string | null,
) =>
  inner === null
    ? null
    : Buffer.from(
        JSON.stringify({ projectId, revision, fingerprint, inner }),
      ).toString("base64url")
export const decodeBusinessCursor = (
  cursor: string | undefined,
  projectId: string,
  revision: number,
  fingerprint: string,
) => {
  if (cursor === undefined) {
    return Effect.succeed(undefined)
  }
  const decoded = Result.try(
    () =>
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown,
  ).pipe(
    Result.flatMap(
      Schema.decodeUnknownResult(Cursor, { onExcessProperty: "error" }),
    ),
  )
  return Result.match(decoded, {
    onSuccess: (value) =>
      value.projectId === projectId &&
      value.revision === revision &&
      value.fingerprint === fingerprint
        ? Effect.succeed(value.inner)
        : Effect.fail(
            new InvalidInput({
              cause:
                "The publication or selection changed. Restart from the first page.",
            }),
          ),
    onFailure: () =>
      Effect.fail(
        new InvalidInput({ cause: "Invalid projected evidence cursor." }),
      ),
  })
}
