import { Effect, Layer, Option } from "effect"
import { describe, expect, it, vi } from "vitest"
import { Unauthorized, PersistenceError } from "../../src/errors.js"
import { AuthorizeProject } from "../../src/features/project-access/use-cases/authorize-project.js"
import { ResultDeclarations } from "../../src/features/result-declarations/ports/result-declarations.js"
import { ManageResultDeclarations } from "../../src/features/result-declarations/use-cases/manage-result-declarations.js"
import type { ResultDeclaration, SearchFields } from "@flowmarkdev/core"

const definition = {
  version: 1,
  source: "booking-app",
  workflow: "booking.create",
  result: {
    revision: "booking-v1",
    fields: [
      { path: ["submitted"], label: "Submitted bookings", kind: "count" },
    ],
  },
  searchFields: [{ key: "bookingRef", role: "lookup" }],
}

const fixture = () => {
  const authorizeUser = vi.fn((userId: string, projectId?: string) =>
    userId === "owner" && projectId
      ? Effect.succeed(projectId)
      : Effect.fail(new Unauthorized({ permission: "read" })),
  )
  const find = vi.fn(() => Effect.succeed(Option.none<ResultDeclaration>()))
  const searchFields = vi.fn(
    (): Effect.Effect<SearchFields, PersistenceError> => Effect.succeed([]),
  )
  const create = vi.fn(() => Effect.succeed(true))
  const setSearchFields = vi.fn(() => Effect.succeed([]))
  const layer = ManageResultDeclarations.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(
          AuthorizeProject,
          AuthorizeProject.of({
            authorizeUser,
            authorize: () => Effect.die("Unexpected key authorization"),
            authorizeDelegatedReader: () =>
              Effect.die("Unexpected delegated authorization"),
          }),
        ),
        Layer.succeed(
          ResultDeclarations,
          ResultDeclarations.of({
            find,
            searchFields,
            create,
            setSearchFields,
            list: () => Effect.die("Unbounded history read"),
          }),
        ),
      ),
    ),
  )
  const run = (
    input: unknown = definition,
    userId = "owner",
    projectId = "project-1",
  ) =>
    Effect.runPromise(
      Effect.flatMap(ManageResultDeclarations, (manage) =>
        manage.previewImport(userId, projectId, input),
      ).pipe(Effect.provide(layer)),
    )
  return { run, find, searchFields, create, setSearchFields, authorizeUser }
}

describe("session-owned metadata preview", () => {
  it("authorizes the explicit project and reads only its requested revision without writing", async () => {
    const f = fixture()
    const result = await f.run()
    expect(result.status).toBe("Reviewable")
    expect(f.authorizeUser).toHaveBeenCalledWith("owner", "project-1")
    expect(f.find).toHaveBeenCalledWith(
      "project-1",
      "booking.create",
      "booking-v1",
    )
    expect(f.searchFields).toHaveBeenCalledWith("project-1", "booking.create")
    expect(f.create).not.toHaveBeenCalled()
    expect(f.setSearchFields).not.toHaveBeenCalled()
  })

  it("rejects unauthorized users before decoding or accessing metadata", async () => {
    const f = fixture()
    await expect(f.run(null, "stranger")).rejects.toMatchObject({
      _tag: "Unauthorized",
    })
    expect(f.find).not.toHaveBeenCalled()
    expect(f.searchFields).not.toHaveBeenCalled()
  })

  it("rejects unknown nested metadata before reading", async () => {
    const f = fixture()
    await expect(
      f.run({
        ...definition,
        result: { ...definition.result, overwrite: true },
      }),
    ).rejects.toMatchObject({ _tag: "InvalidInput" })
    expect(f.searchFields).not.toHaveBeenCalled()
  })

  it("propagates read failure rather than pretending there is no existing metadata", async () => {
    const f = fixture()
    f.searchFields.mockReturnValue(
      Effect.fail(
        new PersistenceError({
          operation: "read",
          cause: "synthetic read failure",
        }),
      ),
    )
    await expect(f.run()).rejects.toMatchObject({ _tag: "PersistenceError" })
  })

  it("binds fingerprints to project, source, request and current state", async () => {
    const f = fixture()
    const first = await f.run()
    expect(await f.run()).toEqual(first)
    const project = await f.run(definition, "owner", "project-2")
    const source = await f.run({ ...definition, source: "other-app" })
    const changed = await f.run({
      ...definition,
      result: { ...definition.result, revision: "booking-v2" },
    })
    expect(
      new Set([
        first.baseFingerprint,
        project.baseFingerprint,
        source.baseFingerprint,
        changed.baseFingerprint,
      ]).size,
    ).toBe(4)
    expect(changed.manifestFingerprint).not.toBe(first.manifestFingerprint)
    f.searchFields.mockReturnValue(
      Effect.succeed([{ key: "region", role: "lookup" }]),
    )
    const stale = await f.run()
    expect(stale.baseFingerprint).not.toBe(first.baseFingerprint)
    expect(stale.manifestFingerprint).toBe(first.manifestFingerprint)
  })

  it("does not read revision history for a search-only preview", async () => {
    const f = fixture()
    expect(
      (await f.run({ ...definition, result: undefined })).result.action,
    ).toBe("NotRequested")
    expect(f.find).not.toHaveBeenCalled()
  })
})
