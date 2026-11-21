import { exportLiveQuestion } from "../../investigations/rules/export-evidence.js"
import { visibleSharedInvestigations } from "./visible-shared-investigations.js"
import { Array, Context, Effect, Layer, Option, Schema } from "effect"
import {
  MeaningProposalSchema,
  type MeaningProposalResolution,
  ShareInvestigationSchema,
  SharedInvestigationListSchema,
} from "@flowmarkdev/core"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { savedEvidenceAuthorization } from "../../project-access/use-cases/authorize-saved-evidence.js"
import type { ProjectReader } from "../../workflows/models/project-reader.js"
import { CurrentProjectReader } from "../../workflows/models/current-project-reader.js"
import {
  decodePublication,
  publicationMeaning,
  samePath,
} from "../../business-evidence/rules/publication.js"
import {
  decodeBusinessCursor,
  encodeBusinessCursor,
  queryFingerprint,
} from "../../business-evidence/rules/cursor.js"
import { SharedInvestigations } from "../ports/shared-investigations.js"
import { validateSharedSelection } from "../rules/selection.js"
import {
  inspectProposalExample,
  sameMeaningProposal,
  unavailableProposal,
} from "../rules/meaning-proposal.js"
const Id = Schema.String.check(Schema.isGUID())
const unavailable = () =>
  new InvalidInput({ cause: "This shared investigation is unavailable." })
const decode = <S extends Schema.Top>(schema: S, raw: unknown) =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(raw).pipe(
    Effect.mapError(
      () =>
        new InvalidInput({
          cause:
            "Invalid shared investigation. Use a supported question without credentials or extra fields.",
        }),
    ),
  )
export class ManageSharedInvestigations extends Context.Service<ManageSharedInvestigations>()(
  "@flowmark/api/ManageSharedInvestigations",
  {
    make: Effect.gen(function* () {
      const repository = yield* SharedInvestigations
      const authorize = yield* savedEvidenceAuthorization
      const use = <A>(
        reader: ProjectReader,
        projectId: string,
        write: boolean,
        run: Parameters<typeof repository.withAccess<A>>[2],
      ) =>
        authorize(reader, projectId).pipe(
          Effect.flatMap(() => repository.withAccess(projectId, write, run)),
          Effect.provideService(CurrentProjectReader, reader),
        )
      const get = Effect.fn("SharedInvestigations.get")(function* (
        reader: ProjectReader,
        projectId: string,
        raw: unknown,
      ) {
        const id = yield* decode(Id, raw)
        return yield* use(reader, projectId, false, (access) =>
          visibleSharedInvestigations(
            projectId,
            access,
            reader._tag === "User",
          ).pipe(
            Effect.flatMap(({ rows }) =>
              Array.findFirst(rows, (row) => row.id === id).pipe(
                Option.match({
                  onSome: Effect.succeed,
                  onNone: () => Effect.fail(unavailable()),
                }),
              ),
            ),
          ),
        )
      })
      const native = <A>(
        reader: ProjectReader,
        projectId: string,
        write: boolean,
        run: Parameters<typeof repository.withAccess<A>>[2],
      ) =>
        reader._tag === "User"
          ? use(reader, projectId, write, run)
          : Effect.fail(
              new Unauthorized({ permission: write ? "write" : "read" }),
            )
      return {
        submitProposal: Effect.fn("MeaningProposal.submit")(function* (
          reader: ProjectReader,
          projectId: string,
          raw: unknown,
        ) {
          const command = yield* decode(MeaningProposalSchema, raw)
          return yield* native(reader, projectId, true, (access) =>
            Effect.gen(function* () {
              const current = yield* inspectProposalExample(access, command)
              const [prior] = yield* access.proposals(command.id)
              if (prior) {
                if (
                  prior.creatorId !== access.userId ||
                  !prior.proposal ||
                  prior.proposal.publicationRevision !== access.revision ||
                  !sameMeaningProposal(prior.proposal.command, command)
                ) {
                  return yield* unavailableProposal()
                }
                return { id: prior.id }
              }
              if (current.revision !== current.headRevision) {
                return yield* new InvalidInput({
                  cause: "Use a published example from the current definition.",
                })
              }
              if (command.label.trim() === current.field.label) {
                return yield* new InvalidInput({
                  cause:
                    "Enter a proposed label that differs from the published label.",
                })
              }
              return yield* access.submitProposal({
                command,
                workflow: current.workflow,
                revision: current.revision,
                headRevision: current.headRevision,
                codeOwned: current.codeOwned,
                publicationRevision: access.revision,
                beforeLabel: current.field.label,
                unit: current.field.unit,
              })
            }),
          )
        }),
        listProposals: Effect.fn("MeaningProposal.list")(function* (
          reader: ProjectReader,
          projectId: string,
        ) {
          return yield* native(reader, projectId, false, (access) =>
            Effect.gen(function* () {
              const rows = yield* access.proposals()
              return {
                canResolve: access.role === "owner",
                items: Array.flatMap(
                  rows,
                  ({ id, creatorId, resolution, proposal }) =>
                    proposal
                      ? [
                          {
                            id,
                            creatorId,
                            resolution,
                            proposal:
                              access.revision === proposal.publicationRevision
                                ? {
                                    command: proposal.command,
                                    workflow: proposal.workflow,
                                    revision: proposal.revision,
                                    beforeLabel: proposal.beforeLabel,
                                    unit: proposal.unit,
                                    codeOwned:
                                      access.role === "owner" &&
                                      proposal.codeOwned,
                                  }
                                : null,
                            publicationChanged:
                              access.revision !== proposal.publicationRevision,
                          },
                        ]
                      : [],
                ),
              }
            }),
          )
        }),
        resolveProposal: Effect.fn("MeaningProposal.resolve")(function* (
          reader: ProjectReader,
          projectId: string,
          id: string,
          resolution: MeaningProposalResolution,
        ) {
          return yield* native(reader, projectId, true, (access) =>
            Effect.gen(function* () {
              if (access.role !== "owner") {
                return yield* new Unauthorized({ permission: "write" })
              }
              const [row] = yield* access.proposals(id)
              if (!row?.proposal) {
                return yield* unavailableProposal()
              }
              if (row.resolution === resolution) {
                return { id, resolution }
              }
              if (row.resolution) {
                return yield* new InvalidInput({
                  cause:
                    "This proposal has already been resolved. Refresh the review.",
                })
              }
              const current = yield* inspectProposalExample(
                access,
                row.proposal.command,
              )
              if (
                access.revision !== row.proposal.publicationRevision ||
                current.headRevision !== row.proposal.headRevision ||
                current.revision !== row.proposal.revision ||
                current.workflow !== row.proposal.workflow
              ) {
                return yield* new InvalidInput({
                  cause:
                    "The published example or definition changed. Request a fresh proposal.",
                })
              }
              const proposal = row.proposal
              if (resolution === "accepted") {
                const existing = yield* access.proposals()
                if (
                  existing.some(
                    (other) =>
                      other.id !== id &&
                      other.resolution === "accepted" &&
                      other.proposal?.workflow === proposal.workflow &&
                      other.proposal.headRevision === proposal.headRevision &&
                      samePath(
                        other.proposal.command.path,
                        proposal.command.path,
                      ),
                  )
                ) {
                  return yield* new InvalidInput({
                    cause:
                      "Another proposal for this field and base is already accepted. Review the accepted proposal before applying a new revision.",
                  })
                }
              }
              return yield* access.resolveProposal(id, resolution)
            }),
          )
        }),
        create: Effect.fn("SharedInvestigations.create")(function* (
          reader: ProjectReader,
          projectId: string,
          raw: unknown,
        ) {
          if (reader._tag !== "User") {
            return yield* new Unauthorized({ permission: "write" })
          }
          const input = yield* decode(ShareInvestigationSchema, raw)
          return yield* use(reader, projectId, true, (access) =>
            Effect.gen(function* () {
              const meaning =
                input.selection.depth === "business"
                  ? publicationMeaning(
                      yield* decodePublication(access.publication),
                      yield* access.choices(),
                    )
                  : { results: [], references: [] }
              yield* validateSharedSelection(
                projectId,
                access.role,
                input.selection,
                meaning,
              )
              return { id: yield* access.create(input) }
            }),
          )
        }),
        export: Effect.fn("SharedInvestigations.export")(function* (
          reader: ProjectReader,
          projectId: string,
          raw: unknown,
        ) {
          const value = yield* get(reader, projectId, raw)
          return yield* exportLiveQuestion("project", value)
        }),
        get,
        list: Effect.fn("SharedInvestigations.list")(function* (
          reader: ProjectReader,
          projectId: string,
          raw: unknown,
        ) {
          const query = yield* decode(SharedInvestigationListSchema, raw)
          return yield* use(reader, projectId, false, (access) =>
            Effect.gen(function* () {
              const limit = query.limit ?? 25
              const fingerprint = queryFingerprint({
                kind: "shared-investigations",
                principal:
                  reader._tag === "DelegatedUser"
                    ? [reader._tag, reader.clientId, reader.authorizationCodeId]
                    : reader._tag,
                userId: access.userId,
                role: access.role,
                limit,
              })
              const after = yield* decodeBusinessCursor(
                query.cursor,
                projectId,
                access.revision,
                fingerprint,
              )
              const { summaries: rows } = yield* visibleSharedInvestigations(
                projectId,
                access,
                reader._tag === "User",
              )
              const start =
                after === undefined
                  ? 0
                  : Array.findFirstIndex(rows, (row) => row.id === after).pipe(
                      Option.map((index) => index + 1),
                      Option.getOrNull,
                    )
              if (start === null) {
                return yield* new InvalidInput({
                  cause: "Shared list changed. Restart from the first page.",
                })
              }
              const page = Array.take(Array.drop(rows, start), limit)
              return {
                items: page,
                nextCursor: encodeBusinessCursor(
                  projectId,
                  access.revision,
                  fingerprint,
                  start + page.length < rows.length
                    ? Array.last(page).pipe(
                        Option.map((row) => row.id),
                        Option.getOrNull,
                      )
                    : null,
                ),
              }
            }),
          )
        }),
        revoke: Effect.fn("SharedInvestigations.revoke")(function* (
          reader: ProjectReader,
          projectId: string,
          raw: unknown,
        ) {
          if (reader._tag !== "User") {
            return yield* new Unauthorized({ permission: "write" })
          }
          const id = yield* decode(Id, raw)
          return yield* use(reader, projectId, true, (access) =>
            access.revoke(id),
          )
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
