import {
  RepositoryInstallationBootstrapInputSchema,
  RepositoryInstallationCreateSchema,
  RepositoryInstallationRevokeSchema,
  RepositoryInstallationVerifyReadbackSchema,
  RepositoryInstallations,
} from "@flowmark/api"
import { Effect, Schema } from "effect"
import { t } from "./context"
import { readQuery, sessionQuery } from "./execution"
import { UuidSchema } from "./schemas"

const ProjectIdInput = Schema.toStandardSchemaV1(
  Schema.Struct({ projectId: UuidSchema }),
)

export const repositoryInstallationRouter = t.router({
  list: t.procedure
    .input(ProjectIdInput)
    .query(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(RepositoryInstallations, (installations) =>
          installations.list(userId, input.projectId),
        ),
      ),
    ),
  connect: t.procedure
    .input(Schema.toStandardSchemaV1(RepositoryInstallationCreateSchema))
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(RepositoryInstallations, (installations) =>
          installations.connect(userId, input),
        ),
      ),
    ),
  revoke: t.procedure
    .input(Schema.toStandardSchemaV1(RepositoryInstallationRevokeSchema))
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(RepositoryInstallations, (installations) =>
          installations.revoke(userId, input),
        ),
      ),
    ),
  verifyDisposableReadback: t.procedure
    .input(
      Schema.toStandardSchemaV1(RepositoryInstallationVerifyReadbackSchema),
    )
    .mutation(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(RepositoryInstallations, (installations) =>
          installations.verifyDisposableReadback(reader, input),
        ),
      ),
    ),
  prepareBootstrapPr: t.procedure
    .input(
      Schema.toStandardSchemaV1(RepositoryInstallationBootstrapInputSchema),
    )
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(RepositoryInstallations, (installations) =>
          installations.prepareBootstrapPr(userId, input),
        ),
      ),
    ),
})
