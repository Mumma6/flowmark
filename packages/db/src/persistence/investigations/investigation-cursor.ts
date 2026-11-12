import { Result, Schema } from "effect"
const Cursor = Schema.Struct({
  version: Schema.Literal(1),
  userId: Schema.String.check(Schema.isMaxLength(256)),
  projectId: Schema.String.check(Schema.isGUID()),
  id: Schema.String.check(Schema.isGUID()),
  createdAt: Schema.String.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
    Schema.makeFilter((value) => Number.isFinite(Date.parse(value))),
  ),
})
export const encodeInvestigationCursor = (
  userId: string,
  projectId: string,
  last: { readonly id: string; readonly createdAt: string },
) =>
  JSON.stringify({
    version: 1,
    userId,
    projectId,
    id: last.id,
    createdAt: last.createdAt,
  })
export const decodeInvestigationCursor = (
  userId: string,
  projectId: string,
  value: string,
) =>
  Schema.decodeUnknownResult(Schema.fromJsonString(Cursor), {
    onExcessProperty: "error",
  })(value).pipe(
    Result.flatMap((cursor) =>
      cursor.userId === userId && cursor.projectId === projectId
        ? Result.succeed(cursor)
        : Result.fail("Cursor scope mismatch."),
    ),
  )
