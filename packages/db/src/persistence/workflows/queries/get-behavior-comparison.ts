import {
  type BehaviorComparison,
  type BehaviorComparisonCohort,
  type BehaviorComparisonExample,
  type BehaviorComparisonMetric,
  type BehaviorComparisonQuery,
} from "@flowmarkdev/core"
import { and, eq, inArray, sql } from "drizzle-orm"
import { Array, Effect, Record } from "effect"
import {
  deploymentBindings,
  deploymentReceipts,
} from "../../../schema/index.js"
import type { FlowmarkDatabase } from "../../../client.js"
import { Database, DatabaseError } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { behaviorCohortSql } from "../sql/behavior-comparison.js"

type ClassifiedRun = Readonly<
  Record<BehaviorComparisonMetric, string | null>
> & {
  readonly runId: string
  readonly observationEventId: string | null
  readonly reportedLoss: number
  readonly otherDeployment: boolean
  readonly otherBehaviorDeployment: boolean
}

const examples = (
  rows: readonly ClassifiedRun[],
  metric: BehaviorComparisonMetric,
) =>
  Array.flatMap(rows, (row): readonly BehaviorComparisonExample[] => {
    const signalEventId = row[metric]
    return row.observationEventId && signalEventId
      ? [
          {
            runId: row.runId,
            observationEventId: row.observationEventId,
            signalEventId,
          },
        ]
      : []
  })

const eligible = (rows: readonly ClassifiedRun[]) =>
  Array.filter(
    rows,
    (row) => row.observationEventId !== null && !row.otherDeployment,
  )

const summarize = (
  rows: readonly ClassifiedRun[],
  artifact: Pick<BehaviorComparisonCohort, "artifactDigest" | "revision">,
): BehaviorComparisonCohort => {
  const population = eligible(rows)
  return {
    artifactDigest: artifact.artifactDigest,
    revision: artifact.revision,
    eligibleRuns: population.length,
    otherDeploymentRuns: rows.filter((row) => row.otherBehaviorDeployment)
      .length,
    ambiguousRuns: rows.filter(
      (row) => row.observationEventId !== null && row.otherDeployment,
    ).length,
    unattributedRuns: rows.filter(
      (row) => row.observationEventId === null && !row.otherBehaviorDeployment,
    ).length,
    reportedLoss: Array.reduce(
      rows,
      0,
      (total, row) => total + row.reportedLoss,
    ),
    counts: Record.map(
      {
        handledError: "handledError",
        fallback: "fallback",
        partialOutcome: "partialOutcome",
        normalPath: "normalPath",
      } satisfies Record<BehaviorComparisonMetric, BehaviorComparisonMetric>,
      (metric) => {
        const matches = examples(population, metric)
        return { total: matches.length, examples: matches.slice(0, 2) }
      },
    ),
  }
}

export const getBehaviorComparison = Effect.fn("getBehaviorComparison")(
  function* (
    projectId: string,
    query: BehaviorComparisonQuery,
  ): Effect.fn.Return<BehaviorComparison, DatabaseError, FlowmarkDatabase> {
    const db = yield* Database
    yield* runQuery(DatabaseOperation.ReadBehaviorComparison, () =>
      db.execute(sql`SET LOCAL statement_timeout = '4s'`),
    )
    const receipts = yield* runQuery(
      DatabaseOperation.ReadBehaviorComparison,
      () =>
        db
          .select({
            deploymentId: deploymentReceipts.deploymentId,
            manifest: deploymentReceipts.manifest,
            repository: deploymentBindings.repository,
            service: deploymentBindings.service,
            environment: deploymentBindings.environment,
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
              eq(deploymentReceipts.bindingId, query.bindingId),
              inArray(deploymentReceipts.deploymentId, [
                query.before.deploymentId,
                query.after.deploymentId,
              ]),
            ),
          ),
    )
    const before = receipts.find(
      (receipt) => receipt.deploymentId === query.before.deploymentId,
    )
    const after = receipts.find(
      (receipt) => receipt.deploymentId === query.after.deploymentId,
    )
    if (!before || !after) {
      return { status: "unsupported", reason: "deployment-not-found" }
    }
    const revisions = new Set(
      Array.flatMap([before, after], ({ manifest }) =>
        manifest.probes
          .filter(({ behaviorId }) => behaviorId === query.behaviorId)
          .map(({ behaviorRevision }) => behaviorRevision),
      ),
    )
    const [behaviorRevision] = revisions
    const hasSource = (receipt: typeof before) =>
      receipt.manifest.probes.some(
        ({ behaviorId, location }) =>
          behaviorId === query.behaviorId && location.kind === "source",
      )
    if (
      revisions.size !== 1 ||
      !behaviorRevision ||
      !hasSource(before) ||
      !hasSource(after)
    ) {
      return {
        status: "unsupported",
        reason: "incompatible-behavior-revisions",
      }
    }
    const read = (name: "before" | "after", artifactDigest: string) =>
      runQuery(DatabaseOperation.ReadBehaviorComparison, () =>
        db.execute<{ exceeded: boolean; rows: ClassifiedRun[] }>(
          behaviorCohortSql(
            projectId,
            query,
            query[name],
            artifactDigest,
            behaviorRevision,
          ),
        ),
      )
    const [beforeRead] = yield* read("before", before.manifest.artifactDigest)
    const [afterRead] = yield* read("after", after.manifest.artifactDigest)
    if (!beforeRead || !afterRead) {
      return yield* new DatabaseError({
        operation: DatabaseOperation.ReadBehaviorComparison,
        cause: "Missing behavior comparison cohort result.",
      })
    }
    if (beforeRead.exceeded || afterRead.exceeded) {
      return { status: "unsupported", reason: "read-budget" }
    }
    const baseline = summarize(beforeRead.rows, before.manifest)
    const successor = summarize(afterRead.rows, after.manifest)
    const both = [baseline, successor]
    const limitations = [
      ...(!query.before.samplingPolicy || !query.after.samplingPolicy
        ? ["sampling-unknown"]
        : query.before.samplingPolicy !== query.after.samplingPolicy
          ? ["sampling-changed"]
          : []),
      ...(both.some((cohort) => cohort.eligibleRuns < 5)
        ? ["thin-evidence"]
        : []),
      ...(both.some(
        (cohort) => cohort.otherDeploymentRuns > 0 || cohort.ambiguousRuns > 0,
      )
        ? ["mixed-deployment-traffic"]
        : []),
      ...(both.some((cohort) => cohort.unattributedRuns > 0)
        ? ["unattributed-runs"]
        : []),
      ...(both.some((cohort) => cohort.reportedLoss > 0)
        ? ["reported-loss"]
        : []),
    ]
    const selection = query.drilldown
    const drilldown =
      selection &&
      (() => {
        const matches = examples(
          eligible(
            selection.cohort === "before" ? beforeRead.rows : afterRead.rows,
          ),
          selection.metric,
        )
        const afterRunId = selection.afterRunId ?? ""
        const page = matches
          .filter(({ runId }) => runId > afterRunId)
          .slice(0, 26)
        return {
          total: matches.length,
          examples: page.slice(0, 25),
          nextAfterRunId: page.length > 25 ? (page[24]?.runId ?? null) : null,
        }
      })()
    return {
      status: limitations.length ? "limited" : "comparable-recorded-cohorts",
      environment: before.environment,
      repository: before.repository,
      service: before.service,
      behaviorRevision,
      limitations,
      before: baseline,
      after: successor,
      ...(drilldown ? { drilldown } : {}),
    }
  },
)
