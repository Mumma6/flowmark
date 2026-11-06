import { basename } from "node:path"
import { Effect, Schema } from "effect"
import { CommandConfigurationError } from "../environment/error.js"

export const expectedDatabaseCases = [
  "created projects return the stored timestamp with a timezone offset",
  "compact facts preserve raw historical populations, ordering, ownership and repair",
  "only accepted inserts change facts, including continuation and late terminal decisions",
  "delegated grant reads intersect membership, reject non-members and stale rows, and survive concurrent consent",
] as const

export const expectedServerFiles = [
  "authenticated-ingestion",
  "ingestion",
  "browser-ingestion",
  "attempts",
  "business-insights",
  "peer-comparison",
  "safe-operation-errors",
  "expectations",
  "auth-perimeter",
  "durable-auth-limits",
  "storage-failure",
] as const

const invalid = () =>
  new CommandConfigurationError({
    reason:
      "Integration report is empty, failed, skipped, or missing required database coverage. Inspect the saved test reports.",
  })

export const verifyDatabaseReport = Effect.fn("verifyDatabaseReport")(
  function* (tap: string) {
    const summary = (name: string) =>
      Number(tap.match(new RegExp(`^# ${name} (\\d+)$`, "m"))?.[1] ?? NaN)
    const passed = [...tap.matchAll(/^ok \d+ - (.+)$/gm)].map(
      (match) => match[1],
    )
    if (
      !(summary("tests") > 0) ||
      summary("fail") !== 0 ||
      summary("skipped") !== 0 ||
      summary("cancelled") !== 0 ||
      summary("todo") !== 0 ||
      !expectedDatabaseCases.every((name) => passed.includes(name))
    ) {
      return yield* invalid()
    }
  },
)

const ServerReport = Schema.Struct({
  numTotalTests: Schema.Number,
  numPendingTests: Schema.Number,
  numFailedTests: Schema.Number,
  testResults: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      assertionResults: Schema.Array(Schema.Struct({ status: Schema.String })),
    }),
  ),
})

export const verifyServerReport = Effect.fn("verifyServerReport")(function* (
  input: unknown,
) {
  const report = yield* Schema.decodeUnknownEffect(ServerReport)(input).pipe(
    Effect.mapError(invalid),
  )
  if (
    report.numTotalTests < 1 ||
    report.numPendingTests !== 0 ||
    report.numFailedTests !== 0 ||
    report.testResults.some((file) =>
      file.assertionResults.some((test) => test.status !== "passed"),
    ) ||
    !expectedServerFiles.every((name) =>
      report.testResults.some(
        (file) =>
          basename(file.name) === `${name}.test.ts` &&
          file.assertionResults.length > 0,
      ),
    )
  ) {
    return yield* invalid()
  }
})
