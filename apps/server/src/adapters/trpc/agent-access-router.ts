import { Effect, Schema } from "effect"
import { AgentAccess, InvalidInput } from "@flowmark/api"
import { t } from "./context"
import { UuidSchema } from "./schemas"
import { sessionAgentAccessQuery } from "./execution"
const NonEmptyString = Schema.Trim.pipe(Schema.check(Schema.isMinLength(1)))

const HttpOrHttpsUrlSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^https?:\/\/.+/)),
)

const AgentAccessSubmitConsentInput = Schema.toStandardSchemaV1(
  Schema.Struct({
    oauthConsentId: NonEmptyString,
    clientId: NonEmptyString,
    redirectUri: HttpOrHttpsUrlSchema,
    requestedScopes: Schema.Array(NonEmptyString),
    resourceUrl: Schema.optional(HttpOrHttpsUrlSchema),
    projectIds: Schema.Array(UuidSchema).pipe(
      Schema.check(Schema.isMinLength(1)),
    ),
  }),
)

const AgentAccessConnectionInput = Schema.toStandardSchemaV1(
  Schema.Struct({
    authorizationCodeId: NonEmptyString,
    clientId: NonEmptyString,
  }),
)

export const agentAccessRouter = t.router({
  list: t.procedure.query(({ ctx }) =>
    sessionAgentAccessQuery(ctx.request, (userId) =>
      Effect.flatMap(AgentAccess, (access) => access.listConnections(userId)),
    ),
  ),
  connection: t.procedure
    .input(AgentAccessConnectionInput)
    .query(({ ctx, input }) =>
      sessionAgentAccessQuery(ctx.request, (userId) =>
        Effect.flatMap(AgentAccess, (access) =>
          access.getConnection({
            userId,
            authorizationCodeId: input.authorizationCodeId,
            clientId: input.clientId,
          }),
        ),
      ),
    ),
  submitConsent: t.procedure
    .input(AgentAccessSubmitConsentInput)
    .mutation(({ ctx, input }) =>
      sessionAgentAccessQuery(ctx.request, (userId) =>
        Effect.gen(function* () {
          const explicitMcp = process.env.FLOWMARK_MCP_RESOURCE_URL?.trim()
          const flowmarkApiUrl = process.env.FLOWMARK_API_URL?.trim()
          const derivedMcp =
            explicitMcp ??
            (flowmarkApiUrl
              ? `${flowmarkApiUrl.replace(/\/$/, "")}/mcp`
              : undefined)
          const resourceUrl = input.resourceUrl?.trim() ?? derivedMcp
          if (!resourceUrl) {
            return yield* Effect.fail(
              new InvalidInput({
                cause:
                  "Resource URL is required, or set FLOWMARK_API_URL / FLOWMARK_MCP_RESOURCE_URL for the default MCP resource.",
              }),
            )
          }
          const access = yield* AgentAccess
          return yield* access.submitConsent({
            userId,
            oauthConsentId: input.oauthConsentId,
            clientId: input.clientId,
            redirectUri: input.redirectUri,
            requestedScopes: input.requestedScopes,
            resourceUrl,
            projectIds: input.projectIds,
          })
        }),
      ),
    ),
  revokeConnection: t.procedure
    .input(AgentAccessConnectionInput)
    .mutation(({ ctx, input }) =>
      sessionAgentAccessQuery(ctx.request, (userId) =>
        Effect.flatMap(AgentAccess, (access) =>
          access.revokeConnection({
            userId,
            authorizationCodeId: input.authorizationCodeId,
            clientId: input.clientId,
          }),
        ),
      ),
    ),
})
