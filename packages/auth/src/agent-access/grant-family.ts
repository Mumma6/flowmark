import { Effect, Schema } from "effect"
import type { FlowmarkDatabase } from "@flowmark/db"
import { Database, getAgentAccessGrantFamily } from "@flowmark/db/persistence"
import { AgentAccessContractError } from "./contract-errors.js"

export const AgentAccessGrantFamilySchema = Schema.Struct({
  familyId: Schema.String,
  subjectUserId: Schema.String,
  clientId: Schema.String,
  issuer: Schema.String,
  resource: Schema.String,
})

export type AgentAccessGrantFamily = typeof AgentAccessGrantFamilySchema.Type

export const readAgentAccessGrantFamily = Effect.fn(
  "AgentAccess.readGrantFamily",
)(function* (
  db: FlowmarkDatabase,
  input: {
    readonly subjectUserId: string
    readonly clientId: string
    readonly authorizationCodeId: string
    readonly issuer: string
    readonly resource: string
  },
) {
  const familyId = yield* getAgentAccessGrantFamily(input).pipe(
    Effect.provideService(Database, db),
    Effect.mapError(
      (cause) =>
        new AgentAccessContractError({
          reason: "Grant family could not be read.",
          cause,
        }),
    ),
  )
  if (!familyId) {
    return yield* new AgentAccessContractError({
      reason:
        "The token's grant family is missing, expired, revoked, or does not match the resource.",
    })
  }
  return {
    familyId,
    subjectUserId: input.subjectUserId,
    clientId: input.clientId,
    issuer: input.issuer,
    resource: input.resource,
  } satisfies AgentAccessGrantFamily
})
