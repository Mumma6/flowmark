import { and, eq, gt, isNull, or } from "drizzle-orm"
import { Array as EffectArray, Effect, Option, Schema } from "effect"
import type { FlowmarkDatabase } from "@flowmark/db"
import { oauthRefreshToken } from "@flowmark/db/schema"
import { AgentAccessContractError } from "./contract-errors.js"

export const AgentAccessGrantFamilySchema = Schema.Struct({
  familyId: Schema.String,
  subjectUserId: Schema.String,
  clientId: Schema.String,
  issuer: Schema.String,
  resource: Schema.String,
})

export type AgentAccessGrantFamily = typeof AgentAccessGrantFamilySchema.Type

const activeFamilyRows = (
  db: FlowmarkDatabase,
  input: { readonly subjectUserId: string; readonly clientId: string },
) =>
  db
    .select({
      familyId: oauthRefreshToken.authorizationCodeId,
      subjectUserId: oauthRefreshToken.userId,
      clientId: oauthRefreshToken.clientId,
      resources: oauthRefreshToken.resources,
    })
    .from(oauthRefreshToken)
    .where(
      and(
        eq(oauthRefreshToken.userId, input.subjectUserId),
        eq(oauthRefreshToken.clientId, input.clientId),
        isNull(oauthRefreshToken.revoked),
        or(
          isNull(oauthRefreshToken.expiresAt),
          gt(oauthRefreshToken.expiresAt, new Date()),
        ),
      ),
    )

export const readAgentAccessGrantFamily = Effect.fn(
  "AgentAccess.readGrantFamily",
)(function* (
  db: FlowmarkDatabase,
  input: {
    readonly subjectUserId: string
    readonly clientId: string
    readonly issuer: string
    readonly resource: string
  },
) {
  const rows = yield* Effect.tryPromise({
    try: () => activeFamilyRows(db, input),
    catch: () =>
      new AgentAccessContractError({
        reason: "Grant family could not be read.",
      }),
  })
  const familyIds = EffectArray.dedupe(
    EffectArray.getSomes(
      EffectArray.map(rows, (row) =>
        row.familyId ? Option.some(row.familyId) : Option.none(),
      ),
    ),
  )
  const familyId = familyIds[0]
  if (!familyId || familyIds.length !== 1) {
    return yield* new AgentAccessContractError({
      reason: "Grant family is missing or ambiguous.",
    })
  }
  const bound = EffectArray.every(rows, (row) =>
    EffectArray.contains(row.resources ?? [], input.resource),
  )
  if (!bound) {
    return yield* new AgentAccessContractError({
      reason: "Grant family resource does not match the MCP resource.",
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
