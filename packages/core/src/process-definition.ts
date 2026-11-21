import { Array, Match, Schema } from "effect"
import { IngestionIdentifierSchema } from "./identifiers.js"
import { WorkflowOutcomeSchema } from "./results.js"

const Member = Schema.Struct({
  role: WorkflowOutcomeSchema,
  workflows: Schema.Array(IngestionIdentifierSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(4),
  ),
})
export const ProcessDefinitionSchema = Schema.Struct({
  key: WorkflowOutcomeSchema,
  revision: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: 2147483647 }),
  ),
  members: Schema.Array(Member).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(8),
  ),
}).check(
  Schema.makeFilter(({ members }) => {
    const roles = Array.map(members, ({ role }) => role)
    const names = Array.flatMap(members, ({ workflows }) => workflows)
    return (
      new Set(roles).size === roles.length &&
      new Set(names).size === names.length
    )
  }),
)

export type ProcessDefinition = typeof ProcessDefinitionSchema.Type
export type ProcessMemberMatch = {
  readonly role: string
  readonly status: "Excluded" | "Matched" | "Ambiguous"
  readonly observed: readonly string[]
  readonly missing: readonly string[]
}

export interface ReviewedProcessDefinition {
  readonly source: string
  readonly definition: ProcessDefinition
  readonly matches: readonly ProcessMemberMatch[]
}

export const canonicalProcessDefinition = (value: ProcessDefinition) => ({
  key: value.key,
  revision: value.revision,
  members: Array.map(value.members, ({ role, workflows }) => ({
    role,
    workflows,
  })),
})

export const previewProcessDefinition = (
  definition: ProcessDefinition,
  source: string,
  previous: ReviewedProcessDefinition | null,
  observedWorkflows: readonly string[],
) => {
  const unchanged =
    previous?.source === source &&
    JSON.stringify(canonicalProcessDefinition(previous.definition)) ===
      JSON.stringify(canonicalProcessDefinition(definition))
  const action = Match.value({
    unchanged,
    allowed:
      (!previous || previous.source === source) &&
      definition.revision === (previous?.definition.revision ?? 0) + 1,
  }).pipe(
    Match.when({ unchanged: true }, () => "Unchanged" as const),
    Match.when({ allowed: true }, () => "Create" as const),
    Match.orElse(() => "Conflict" as const),
  )
  if (action === "Unchanged" && previous) {
    return { action, previous, proposed: previous }
  }
  const proposed: ReviewedProcessDefinition = {
    source,
    definition,
    matches: Array.map(definition.members, ({ role, workflows }) => {
      const observed = Array.filter(workflows, (name) =>
        observedWorkflows.includes(name),
      )
      const missing = Array.filter(
        workflows,
        (name) => !observedWorkflows.includes(name),
      )
      return {
        role,
        observed,
        missing,
        status: Match.value(observed.length).pipe(
          Match.when(0, () => "Excluded" as const),
          Match.when(1, () => "Matched" as const),
          Match.orElse(() => "Ambiguous" as const),
        ),
      }
    }),
  }
  return { action, previous, proposed }
}
