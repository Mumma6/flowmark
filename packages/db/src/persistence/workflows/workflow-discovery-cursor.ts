import { Data, Result, Schema } from "effect"

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

export type WorkflowDiscoveryCursorScope = Data.TaggedEnum<{
  Start: Record<never, never>
  Continue: { readonly name: string }
  Invalid: Record<never, never>
}>

export const WorkflowCursor = Data.taggedEnum<WorkflowDiscoveryCursorScope>()

export type RevisionDiscoveryCursorScope = Data.TaggedEnum<{
  Start: Record<never, never>
  Continue: { readonly createdAt: string; readonly id: string }
  Invalid: Record<never, never>
}>

export const RevisionCursor = Data.taggedEnum<RevisionDiscoveryCursorScope>()

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
    return WorkflowCursor.Start()
  }
  const parsed = parseCursor(cursor)
  if (parsed === null) {
    return WorkflowCursor.Invalid()
  }
  return Result.match(
    Schema.decodeUnknownResult(WorkflowDiscoveryCursorSchema)(parsed),
    {
      onFailure: () => WorkflowCursor.Invalid(),
      onSuccess: (value) =>
        value.projectId === projectId
          ? WorkflowCursor.Continue({ name: value.name })
          : WorkflowCursor.Invalid(),
    },
  )
}

export const scopeRevisionDiscoveryCursor = (
  cursor: string | undefined,
  scope: { readonly projectId: string; readonly workflow: string },
): RevisionDiscoveryCursorScope => {
  if (!cursor) {
    return RevisionCursor.Start()
  }
  const parsed = parseCursor(cursor)
  if (parsed === null) {
    return RevisionCursor.Invalid()
  }
  return Result.match(
    Schema.decodeUnknownResult(RevisionDiscoveryCursorSchema)(parsed),
    {
      onFailure: () => RevisionCursor.Invalid(),
      onSuccess: (value) =>
        value.projectId === scope.projectId && value.workflow === scope.workflow
          ? RevisionCursor.Continue({
              createdAt: value.createdAt,
              id: value.id,
            })
          : RevisionCursor.Invalid(),
    },
  )
}
