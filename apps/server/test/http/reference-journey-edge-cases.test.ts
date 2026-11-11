import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Array, Effect, HashSet, Option, Order, Result } from "effect"
import { createDatabase } from "@flowmark/db"
import type { ReferenceJourneyPage, ReferenceJourneyQuery } from "@flowmark/api"
import { GET } from "../../app/api/trpc/[trpc]/route"
import { POST } from "../../app/v1/events/route"
import {
  createJourneyFixture,
  explainJourneyFrontier,
  insertJourneyFixtureRuns,
  journeyNamespaces,
  waitForJourneyDeadline,
  type JourneyFixture,
} from "../../../../packages/db/test/support/reference-journey.js"
import {
  journeyHref,
  journeyPageInput,
  nextJourneyPage,
  readJourneySelection,
  type JourneyPageParam,
} from "../../../dashboard/features/journeys/journey-selection"
import { journeyParentDescription } from "../../../dashboard/features/journeys/journey-presentation"
import { runInvestigationPath } from "../../../dashboard/features/runs/investigation/investigation-navigation"
import type { RouterOutputs } from "../../../dashboard/features/platform/api-types"
import { expectationLabel } from "../../../dashboard/features/expectations/expectation-presentation"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "journey pagination and observation-time boundaries",
  () => {
    let connection: ReturnType<typeof createDatabase>
    let fixture: JourneyFixture
    const input = (
      value: string,
      extra: Partial<ReferenceJourneyQuery> = {},
    ): ReferenceJourneyQuery => ({
      workflow: "patient.match",
      key: "referralRef",
      value,
      namespaces: journeyNamespaces,
      limit: 25,
      ...extra,
    })
    const request = (
      procedure: string,
      query: unknown,
      token = fixture.readKey,
    ) =>
      GET(
        new Request(
          `http://localhost:3001/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(query))}`,
          { headers: { authorization: `Bearer ${token}` } },
        ),
      )
    const read = async <A>(
      procedure: string,
      query: unknown,
      token = fixture.readKey,
    ): Promise<A> => {
      const response = await request(procedure, query, token)
      expect(response.status).toBe(200)
      return ((await response.json()) as { result: { data: A } }).result.data
    }
    const insert = (specs: Parameters<typeof insertJourneyFixtureRuns>[2]) =>
      Effect.runPromise(insertJourneyFixtureRuns(connection.db, fixture, specs))
    const walk: (
      query: ReferenceJourneyQuery,
      page?: JourneyPageParam,
      budget?: number,
    ) => Effect.Effect<readonly ReferenceJourneyPage[]> = (
      query,
      page = { kind: "initial" },
      budget = 8,
    ) =>
      Effect.gen(function* () {
        expect(budget).toBeGreaterThan(0)
        const response = yield* Effect.promise(() =>
          read<ReferenceJourneyPage>(
            "workflow.journey",
            journeyPageInput(query, page),
          ),
        )
        const next = nextJourneyPage(response)
        return next
          ? [response, ...(yield* walk(query, next, budget - 1))]
          : [response]
      })
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      fixture = await Effect.runPromise(createJourneyFixture(connection.db))
    })
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })

    it("keeps all 75 stable executions exactly once across SQL, HTTP and Studio continuation/inspector links", async () => {
      const [root] = await insert([
        { workflow: "patient.match", externalId: "paged-root", value: "PAGED" },
      ])
      const bookings = await insert(
        Array.map(Array.range(1, 69), (index) => ({
          workflow: "appointment.book" as const,
          externalId: `paged-book-${index}`,
          value: "PAGED",
          parentRunId: "paged-root",
          properties: { referralRef: "NOT-THE-SELECTED-NAMESPACE" },
          ...(index === 69
            ? {
                retryOf: {
                  workflow: "appointment.book",
                  runId: "paged-book-1",
                },
              }
            : {}),
        })),
      )
      const notifications = await insert(
        Array.map(Array.range(1, 5), (index) => ({
          workflow: "notification.dispatch" as const,
          externalId: `paged-notify-${index}`,
          value: "PAGED",
          parentRunId: `paged-book-${index}`,
        })),
      )
      const [foreign] = await insert([
        {
          workflow: "patient.match",
          externalId: "paged-root",
          value: "PAGED",
          foreign: true,
        },
      ])
      const pages = await Effect.runPromise(walk(input("PAGED")))
      expect(Array.map(pages, (page) => page.nodes.length)).toEqual([
        25, 25, 25,
      ])
      const ids = Array.flatMap(pages, (page) =>
        Array.map(page.nodes, (node) => node.id),
      )
      const sortedIds = (rows: readonly { id: string }[]) =>
        Array.sort(
          Array.map(rows, (row) => row.id),
          Order.String,
        )
      expect(ids).toEqual([
        root!.id,
        ...sortedIds(bookings),
        ...sortedIds(notifications),
      ])
      expect(HashSet.size(HashSet.fromIterable(ids))).toBe(75)
      expect(
        Array.every(pages, (page) => !page.bounds.traversalTruncated),
      ).toBe(true)
      expect(ids).not.toContain(foreign!.id)
      expect(Array.flatMap(pages, (page) => page.edges)).toContainEqual({
        fromRunId: bookings[0]!.id,
        toRunId: bookings[68]!.id,
        kind: "retry",
        scope: "journey",
      })
      expect(
        Array.map(
          await Effect.runPromise(walk(input("PAGED"))),
          (page) => page.nodes,
        ),
      ).toEqual(Array.map(pages, (page) => page.nodes))
      const cursor = pages[0]!.nextCursor!
      expect(
        (
          await request(
            "workflow.journey",
            input("PAGED", { cursor }),
            fixture.foreignKey,
          )
        ).status,
      ).toBe(400)
      expect(
        (
          await request(
            "workflow.journey",
            input("PAGED", { cursor, anchorRunId: foreign!.id }),
          )
        ).status,
      ).toBe(400)
      const substituted = { ...JSON.parse(cursor), id: foreign!.id }
      expect(
        (
          await request(
            "workflow.journey",
            input("PAGED", { cursor: JSON.stringify(substituted) }),
          )
        ).status,
      ).toBe(400)
      const source = journeyHref("/?status=Failed", {
        projectId: fixture.projectId,
        stage: "evidence",
        query: input("PAGED", { anchorRunId: root!.id }),
      })
      Array.forEach(
        Array.flatMap(pages, (page) => page.nodes),
        (node) => {
          const link = new URL(
            runInvestigationPath(node.id, source, "confirmations"),
            "http://localhost",
          )
          expect(link.pathname).toBe(`/runs/${node.id}`)
          expect(link.searchParams.get("status")).toBe("Failed")
          expect(
            Result.getOrThrow(
              readJourneySelection(
                link.searchParams.get("journey")!,
                fixture.projectId,
              ),
            ).query.anchorRunId,
          ).toBe(root!.id)
        },
      )
      const [plan] = await explainJourneyFrontier(
        connection.db,
        fixture,
        input("PAGED"),
        root!.id,
      )
      const measured = plan!["QUERY PLAN"][0]!
      expect(measured.Plan["Node Type"]).toBe("Limit")
      expect(measured.Plan["Actual Rows"]).toBe(69)
      console.info("Journey frontier EXPLAIN ANALYZE", {
        node: measured.Plan["Node Type"],
        rows: measured.Plan["Actual Rows"],
        executionMs: measured["Execution Time"],
      })
    })

    it("pages more than 100 equal-reference anchor choices without merging or losing them", async () => {
      const candidates = await insert(
        Array.map(Array.range(1, 132), (index) => ({
          workflow: "patient.match" as const,
          externalId: `choice-${index}`,
          value: "MANY-CHOICES",
        })),
      )
      await insert([
        {
          workflow: "patient.match",
          externalId: "choice-foreign",
          value: "MANY-CHOICES",
          foreign: true,
        },
      ])
      const pages = await Effect.runPromise(walk(input("MANY-CHOICES")))
      expect(Array.map(pages, (page) => page.candidates.length)).toEqual([
        25, 25, 25, 25, 25, 7,
      ])
      expect(
        Array.every(
          pages,
          (page) => page.state === "Ambiguous" && page.nodes.length === 0,
        ),
      ).toBe(true)
      const ids = Array.flatMap(pages, (page) =>
        Array.map(page.candidates, (candidate) => candidate.id),
      )
      expect(HashSet.size(HashSet.fromIterable(ids))).toBe(132)
      expect(ids).toEqual(
        Array.sort(
          Array.map(candidates, (row) => row.id),
          Order.String,
        ),
      )
      const cursor = pages[0]!.nextCandidateCursor!
      expect(
        (
          await request(
            "workflow.journey",
            input("MANY-CHOICES", { candidateCursor: cursor }),
            fixture.foreignKey,
          )
        ).status,
      ).toBe(400)
      const forged = {
        ...JSON.parse(cursor),
        startedAt: "2000-01-01T00:00:00.000000Z",
      }
      expect(
        (
          await request(
            "workflow.journey",
            input("MANY-CHOICES", { candidateCursor: JSON.stringify(forged) }),
          )
        ).status,
      ).toBe(400)
      const picked = await read<ReferenceJourneyPage>(
        "workflow.journey",
        input("MANY-CHOICES", { anchorRunId: ids[131] }),
      )
      expect(Array.map(picked.nodes, (node) => node.id)).toEqual([ids[131]])
    })

    it("recovers a previously missing parent only when its qualified evidence arrives", async () => {
      const [child] = await insert([
        {
          workflow: "appointment.book",
          externalId: "orphan-book",
          value: "RECOVER",
          parentRunId: "arrives-later",
        },
      ])
      const query = input("RECOVER", {
        workflow: "appointment.book",
        key: "bookingRef",
        anchorRunId: child!.id,
      })
      const before = await read<ReferenceJourneyPage>("workflow.journey", query)
      expect(before.nodes).toHaveLength(1)
      expect(
        journeyParentDescription(before.nodes[0]!, before.edges),
      ).toContain("missing from recorded evidence")
      const [parent] = await insert([
        {
          workflow: "patient.match",
          externalId: "arrives-later",
          value: "RECOVER",
        },
      ])
      const after = await read<ReferenceJourneyPage>("workflow.journey", query)
      expect(Array.map(after.nodes, (node) => node.id)).toEqual([
        child!.id,
        parent!.id,
      ])
      expect(journeyParentDescription(after.nodes[0]!, after.edges)).toBe(
        "Reported parent · linked journey execution",
      )
    })

    it("keeps partial terminal results separate from real observed on-time, late, cancelled and unobserved confirmations", async () => {
      await insert([
        {
          workflow: "patient.match",
          externalId: "observed-root",
          value: "OBSERVED",
        },
      ])
      const books = await insert(
        Array.map(
          ["on-time", "late", "cancelled", "unobserved"] as const,
          (kind) => ({
            workflow: "appointment.book" as const,
            externalId: `observed-${kind}`,
            value: "OBSERVED",
            parentRunId: "observed-root",
          }),
        ),
      )
      const historical = "2026-10-01T10:00:00.000Z"
      const send = async (event: unknown) => {
        const response = await POST(
          new Request("http://localhost:3001/v1/events", {
            method: "POST",
            headers: {
              authorization: `Bearer ${fixture.writeKey}`,
              "x-flowmark-expectations": "v1",
            },
            body: JSON.stringify({ eventId: randomUUID(), event }),
          }),
        )
        expect(response.status).toBe(202)
      }
      await Effect.runPromise(
        Effect.forEach(books, (book, index) =>
          Effect.gen(function* () {
            const identity = {
              workflow: book.workflow,
              runId: book.externalId,
              timestamp: historical,
            }
            yield* Effect.promise(() =>
              send({
                ...identity,
                type: "started",
                properties: { referralRef: "OBSERVED", bookingRef: "OBSERVED" },
                parentRunId: "observed-root",
              }),
            )
            yield* Effect.promise(() =>
              send({
                ...identity,
                type: "expectation_declared",
                expectationId: "confirmation",
                name: "Booking confirmation",
                withinMs: index === 1 || index === 3 ? 1 : 300000,
              }),
            )
            yield* Effect.promise(() =>
              send({
                ...identity,
                timestamp: "2026-10-01T10:01:00.000Z",
                type: "completed",
                outcome: "pending_confirmation",
                result: { requested: 4, confirmed: 3, pending: 1 },
              }),
            )
          }),
        ),
      )
      const before = await read<RouterOutputs["run"]["detail"]>("run.detail", {
        id: books[1]!.id,
      })
      const lateBefore = await read<RouterOutputs["run"]["expectations"]>(
        "run.expectations",
        { id: books[1]!.id },
      )
      await Effect.runPromise(
        waitForJourneyDeadline(
          connection.db,
          lateBefore.expectations[0]!.deadlineAt!,
        ),
      )
      await send({
        workflow: "appointment.book",
        runId: books[0]!.externalId,
        timestamp: historical,
        type: "expectation_resolved",
        expectationId: "confirmation",
        outcome: "confirmed",
        result: { confirmed: 1 },
      })
      await send({
        workflow: "appointment.book",
        runId: books[1]!.externalId,
        timestamp: historical,
        type: "expectation_resolved",
        expectationId: "confirmation",
        outcome: "confirmed",
        result: { confirmed: 1 },
      })
      await send({
        workflow: "appointment.book",
        runId: books[2]!.externalId,
        timestamp: historical,
        type: "expectation_cancelled",
        expectationId: "confirmation",
        code: "APPLICATION_CANCELLED",
      })
      const views = await Effect.runPromise(
        Effect.forEach(books, (book) =>
          Effect.promise(() =>
            read<RouterOutputs["run"]["expectations"]>("run.expectations", {
              id: book.id,
            }),
          ),
        ),
      )
      expect(
        Array.map(views, (view) => expectationLabel(view.expectations[0]!)),
      ).toEqual([
        "Observed on time",
        "Observed late",
        "Cancelled",
        "Overdue — no resolution observed",
      ])
      expect(views[1]!.expectations[0]!.settlement?.event.timestamp).toBe(
        historical,
      )
      expect(Date.parse(views[1]!.expectations[0]!.settledAt!)).toBeGreaterThan(
        Date.parse(views[1]!.expectations[0]!.deadlineAt!),
      )
      const observed = views[3]!.expectations[0]!
      expect(observed.settlement).toBeNull()
      expect(observed.settledAt).toBeNull()
      const after = await read<RouterOutputs["run"]["detail"]>("run.detail", {
        id: books[1]!.id,
      })
      expect(
        Array.filter(after, (event) => event.type === "completed"),
      ).toEqual(Array.filter(before, (event) => event.type === "completed"))
      const terminal = Option.getOrThrow(
        Array.findFirst(after, (event) => event.type === "completed"),
      )
      expect(terminal).toMatchObject({
        outcome: "pending_confirmation",
        result: { requested: 4, confirmed: 3, pending: 1 },
      })
      const journey = await read<ReferenceJourneyPage>(
        "workflow.journey",
        input("OBSERVED"),
      )
      expect(journey.nodes).toHaveLength(5)
      expect(
        Array.filter(
          journey.nodes,
          (node) => node.workflow === "appointment.book",
        ),
      ).toHaveLength(4)
      expect(
        Array.every(
          Array.filter(
            journey.nodes,
            (node) => node.workflow === "appointment.book",
          ),
          (node) =>
            node.status === "Completed" &&
            node.outcome === "pending_confirmation",
        ),
      ).toBe(true)
      const again = await read<RouterOutputs["run"]["expectations"]>(
        "run.expectations",
        { id: books[1]!.id },
      )
      expect(again.expectations[0]).toEqual(views[1]!.expectations[0])
      expect(Date.parse(again.asOf)).toBeGreaterThanOrEqual(
        Date.parse(views[1]!.asOf),
      )
    }, 15000)
  },
)
