import { and, eq } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"
import type { ArtifactManifest } from "@flowmarkdev/core"
import { deploymentBindings, deploymentReceipts } from "../../schema/index.js"
import { withActiveProject } from "../data-lifecycle/with-active-project.js"
import { Database, DatabaseCancellation, provideDatabase } from "../database.js"
import { DatabaseOperation } from "../database-operation.js"
import { ProjectReadSubject } from "../project-access/read-subject.js"
import { withOwnerProject } from "../project-access/with-owner-project.js"
import { runQuery } from "../run-query.js"

type Scope = {
  readonly projectId: string
  readonly repository: string
  readonly service: string
  readonly environment: string
}

const rotateBinding = Effect.fn("DeploymentStore.rotateBinding")(function* (
  userId: string,
  scope: Scope,
  secretHash: string,
) {
  return yield* withOwnerProject(
    userId,
    scope.projectId,
    Effect.gen(function* () {
      const db = yield* Database
      const [binding] = yield* runQuery(
        DatabaseOperation.DeploymentBinding,
        () =>
          db
            .insert(deploymentBindings)
            .values({ ...scope, secretHash })
            .onConflictDoUpdate({
              target: [
                deploymentBindings.projectId,
                deploymentBindings.repository,
                deploymentBindings.service,
                deploymentBindings.environment,
              ],
              set: { secretHash },
            })
            .returning({ id: deploymentBindings.id }),
      )
      if (!binding) {
        return yield* Effect.die(
          "Deployment binding insert did not return an identity",
        )
      }
      return binding
    }),
  )
})

const record = Effect.fn("DeploymentStore.record")(function* (input: {
  readonly bindingId: string
  readonly secretHash: string
  readonly deploymentId: string
  readonly manifestDigest: string
  readonly manifest: ArtifactManifest
}) {
  const db = yield* Database
  const scope = and(
    eq(deploymentBindings.id, input.bindingId),
    eq(deploymentBindings.secretHash, input.secretHash),
    eq(deploymentBindings.repository, input.manifest.repository),
  )
  const [candidate] = yield* runQuery(DatabaseOperation.DeploymentBinding, () =>
    db
      .select({ projectId: deploymentBindings.projectId })
      .from(deploymentBindings)
      .where(scope),
  )
  if (!candidate) {
    return { status: "denied" } as const
  }

  return yield* withActiveProject(
    candidate.projectId,
    Effect.gen(function* () {
      const activeDb = yield* Database
      const [binding] = yield* runQuery(
        DatabaseOperation.DeploymentBinding,
        () =>
          activeDb
            .select({ id: deploymentBindings.id })
            .from(deploymentBindings)
            .where(
              and(scope, eq(deploymentBindings.projectId, candidate.projectId)),
            )
            .for("share"),
      )
      if (!binding) {
        return { status: "denied" } as const
      }
      const values = {
        projectId: candidate.projectId,
        bindingId: binding.id,
        deploymentId: input.deploymentId,
        manifestDigest: input.manifestDigest,
        manifest: input.manifest,
      }
      const [inserted] = yield* runQuery(
        DatabaseOperation.DeploymentReceipt,
        () =>
          activeDb
            .insert(deploymentReceipts)
            .values(values)
            .onConflictDoNothing()
            .returning(),
      )
      if (inserted) {
        return { status: "recorded", receipt: inserted } as const
      }
      const [existing] = yield* runQuery(
        DatabaseOperation.DeploymentReceipt,
        () =>
          activeDb
            .select()
            .from(deploymentReceipts)
            .where(
              and(
                eq(deploymentReceipts.projectId, values.projectId),
                eq(deploymentReceipts.bindingId, values.bindingId),
                eq(deploymentReceipts.deploymentId, values.deploymentId),
              ),
            ),
      )
      if (!existing || existing.manifestDigest !== input.manifestDigest) {
        return { status: "conflict" } as const
      }
      return { status: "recorded", receipt: existing } as const
    }),
    "current",
  ).pipe(Effect.provideService(ProjectReadSubject, undefined))
})

const read = Effect.fn("DeploymentStore.read")(function* (
  userId: string,
  projectId: string,
  bindingId: string,
  deploymentId: string,
) {
  return yield* withOwnerProject(
    userId,
    projectId,
    Effect.gen(function* () {
      const db = yield* Database
      const [receipt] = yield* runQuery(
        DatabaseOperation.DeploymentReceipt,
        () =>
          db
            .select({
              receipt: deploymentReceipts,
              environment: deploymentBindings.environment,
              service: deploymentBindings.service,
            })
            .from(deploymentReceipts)
            .innerJoin(
              deploymentBindings,
              and(
                eq(deploymentBindings.id, deploymentReceipts.bindingId),
                eq(deploymentBindings.projectId, deploymentReceipts.projectId),
              ),
            )
            .where(
              and(
                eq(deploymentReceipts.projectId, projectId),
                eq(deploymentReceipts.bindingId, bindingId),
                eq(deploymentReceipts.deploymentId, deploymentId),
              ),
            ),
      )
      return receipt ?? null
    }),
  )
})

export class DeploymentStore extends Context.Service<DeploymentStore>()(
  "@flowmark/db/DeploymentStore",
  {
    make: Effect.gen(function* () {
      const db = yield* Database
      const provide = provideDatabase(db, yield* DatabaseCancellation)
      return {
        rotateBinding: (...args: Parameters<typeof rotateBinding>) =>
          provide(rotateBinding(...args)),
        record: (...args: Parameters<typeof record>) =>
          provide(record(...args)),
        read: (...args: Parameters<typeof read>) => provide(read(...args)),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
