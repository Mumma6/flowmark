import { Result, Schema } from "effect"

const Uuid = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ),
)

const WorkflowDiscoveryCursorSchema = Schema.Struct({
  kind: Schema.Literal("workflows"),
  projectId: Uuid,
  name: Schema.String.check(Schema.isMinLength(1)),
})

const RevisionDiscoveryCursorSchema = Schema.Struct({
  kind: Schema.Literal("revisions"),
  projectId: Uuid,
  workflow: Schema.String.check(Schema.isMinLength(1)),
  createdAt: Schema.String.check(
    Schema.makeFilter((value) => !Number.isNaN(Date.parse(value))),
  ),
  id: Uuid,
})

export type WorkflowDiscoveryCursorScope =
  | { readonly _tag: "Start" }
  | { readonly _tag: "Continue"; readonly name: string }
  | { readonly _tag: "Invalid" }

export type RevisionDiscoveryCursorScope =
  | { readonly _tag: "Start" }
  | {
      readonly _tag: "Continue"
      readonly createdAt: string
      readonly id: string
    }
  | { readonly _tag: "Invalid" }

const parseCursor = (cursor: string): unknown => {
  if (cursor.length > 4096) {
    return null
  }
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
  } catch {
    return null
  }
}

const encode = (value: object) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url")

export const encodeWorkflowDiscoveryCursor = (row: {
  readonly projectId: string
  readonly name: string
}): string =>
  encode({
    kind: "workflows",
    projectId: row.projectId,
    name: row.name,
  })

export const encodeRevisionDiscoveryCursor = (row: {
  readonly projectId: string
  readonly workflow: string
  readonly createdAt: string
  readonly id: string
}): string =>
  encode({
    kind: "revisions",
    projectId: row.projectId,
    workflow: row.workflow,
    createdAt: row.createdAt,
    id: row.id,
  })

export const scopeWorkflowDiscoveryCursor = (
  cursor: string | undefined,
  projectId: string,
): WorkflowDiscoveryCursorScope => {
  if (!cursor) {
    return { _tag: "Start" }
  }
  const parsed = parseCursor(cursor)
  if (parsed === null) {
    return { _tag: "Invalid" }
  }
  return Result.match(
    Schema.decodeUnknownResult(WorkflowDiscoveryCursorSchema)(parsed),
    {
      onFailure: () => ({ _tag: "Invalid" }),
      onSuccess: (value) =>
        value.projectId === projectId
          ? { _tag: "Continue", name: value.name }
          : { _tag: "Invalid" },
    },
  )
}

export const scopeRevisionDiscoveryCursor = (
  cursor: string | undefined,
  scope: { readonly projectId: string; readonly workflow: string },
): RevisionDiscoveryCursorScope => {
  if (!cursor) {
    return { _tag: "Start" }
  }
  const parsed = parseCursor(cursor)
  if (parsed === null) {
    return { _tag: "Invalid" }
  }
  return Result.match(
    Schema.decodeUnknownResult(RevisionDiscoveryCursorSchema)(parsed),
    {
      onFailure: () => ({ _tag: "Invalid" }),
      onSuccess: (value) =>
        value.projectId === scope.projectId && value.workflow === scope.workflow
          ? {
              _tag: "Continue",
              createdAt: value.createdAt,
              id: value.id,
            }
          : { _tag: "Invalid" },
    },
  )
}
