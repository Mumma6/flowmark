import { Context, Effect, Layer, Match, Schema } from "effect"
import {
  BusinessEvidenceQuerySchema,
  type BusinessEvidence,
} from "@flowmarkdev/core"
import { InvalidInput } from "../../../errors.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import { AgentAccess } from "../../project-access/ports/agent-access.js"
import type { ProjectReader } from "../../workflows/models/project-reader.js"
import { CurrentProjectReader } from "../../workflows/models/current-project-reader.js"
import { BusinessEvidenceRepository } from "../ports/business-evidence.js"
import {
  decodePublication,
  validatePublication,
  publishableField,
} from "../rules/publication.js"
import { readBusinessData } from "./read-business-data.js"
import { Array } from "effect"
const Replacement = Schema.Struct({
  expectedRevision: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
  ),
  publication: Schema.Unknown,
})
export class GetBusinessEvidence extends Context.Service<GetBusinessEvidence>()(
  "@flowmark/api/GetBusinessEvidence",
  {
    make: Effect.gen(function* () {
      const authorization = yield* AuthorizeProject
      const repository = yield* BusinessEvidenceRepository
      const agent = yield* AgentAccess
      const project = Effect.fn("BusinessEvidence.authorize")(function* (
        reader: ProjectReader,
      ) {
        return yield* Match.value(reader).pipe(
          Match.tag("Key", (r) => authorization.authorize(r.header, "read")),
          Match.tag("User", (r) =>
            authorization.authorizeUser(r.userId, r.projectId),
          ),
          Match.tag("DelegatedUser", (r) =>
            authorization.authorizeDelegatedReader(r).pipe(
              Effect.tap(() =>
                agent.recordLastAuthenticated({
                  userId: r.userId,
                  clientId: r.clientId,
                  authorizationCodeId: r.authorizationCodeId,
                  at: new Date(),
                }),
              ),
            ),
          ),
          Match.exhaustive,
        )
      })
      return {
        capabilities: Effect.fn("BusinessEvidence.capabilities")(function* (
          reader: ProjectReader,
        ) {
          const projectId = yield* project(reader)
          return yield* repository
            .withRead(projectId, (access) =>
              Effect.succeed({
                projectId,
                role: access.role,
                depth:
                  access.role === "business"
                    ? ("business" as const)
                    : ("diagnostic" as const),
                publicationRevision: access.revision,
              }),
            )
            .pipe(Effect.provideService(CurrentProjectReader, reader))
        }),
        read: Effect.fn("BusinessEvidence.read")(function* (
          reader: ProjectReader,
          raw: unknown,
        ) {
          const projectId = yield* project(reader)
          const input = yield* Schema.decodeUnknownEffect(
            BusinessEvidenceQuerySchema,
            { onExcessProperty: "error" },
          )(raw).pipe(
            Effect.mapError(
              () =>
                new InvalidInput({
                  cause:
                    "Unsupported business evidence selection. Diagnostic selectors are withheld.",
                }),
            ),
          )
          return yield* repository
            .withRead(projectId, (access) =>
              Effect.gen(function* () {
                const publication = yield* decodePublication(access.publication)
                const data = yield* readBusinessData(
                  projectId,
                  access,
                  publication,
                  input,
                )
                const evidence: BusinessEvidence = {
                  projection: {
                    version: 1,
                    depth: "business",
                    projectId,
                    publicationRevision: access.revision,
                    observedAt: new Date().toISOString(),
                    withheld: [
                      "externalIds",
                      "unpublishedProperties",
                      "unpublishedResults",
                      "errors",
                      "operations",
                      "rawEvents",
                      "expectationPayloads",
                      "environment",
                      "release",
                    ],
                  },
                  data,
                }
                if (
                  new TextEncoder().encode(JSON.stringify(evidence))
                    .byteLength >
                  256 * 1024
                ) {
                  return yield* new InvalidInput({
                    cause:
                      "Published evidence exceeds the response bound. Narrow the selection.",
                  })
                }
                return evidence
              }),
            )
            .pipe(Effect.provideService(CurrentProjectReader, reader))
        }),
        configuration: Effect.fn("BusinessEvidence.configuration")(function* (
          userId: string,
          projectId: string,
        ) {
          yield* authorization.authorizeOwner(userId, projectId)
          const config = yield* repository.configuration(userId, projectId)
          return {
            revision: config.revision,
            publication: yield* decodePublication(config.publication),
            choices: {
              declarations: Array.map(config.choices.declarations, (row) => ({
                workflow: row.workflow,
                declaration: {
                  revision: row.declaration.revision,
                  fields: Array.filter(
                    row.declaration.fields,
                    publishableField,
                  ),
                },
              })),
              references: config.choices.references,
            },
          }
        }),
        replace: Effect.fn("BusinessEvidence.replace")(function* (
          userId: string,
          projectId: string,
          raw: unknown,
        ) {
          yield* authorization.authorizeOwner(userId, projectId)
          const command = yield* Schema.decodeUnknownEffect(Replacement, {
            onExcessProperty: "error",
          })(raw).pipe(
            Effect.mapError(
              () =>
                new InvalidInput({ cause: "Invalid publication replacement." }),
            ),
          )
          const publication = yield* decodePublication(command.publication)
          const saved = yield* repository.replace(
            userId,
            projectId,
            command.expectedRevision,
            publication,
            (choices) => validatePublication(publication, choices),
          )
          return { revision: saved.revision, publication }
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
