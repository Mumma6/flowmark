import {
  classifyReceiptCohort,
  type BehaviorComparison,
  type BehaviorComparisonCohort,
  type BehaviorComparisonExample,
  type BehaviorComparisonMetric,
  type BehaviorComparisonQuery,
  type ReceiptCohort,
} from "@flowmarkdev/core"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { Array, Effect, Option, Record } from "effect"
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
  readonly otherObservationEventId: string | null
  readonly otherDeploymentId: string | null
  readonly otherArtifactDigest: string | null
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
): Omit<
  BehaviorComparisonCohort,
  "receiptCohort" | "rate" | "examplesByArtifact"
> => {
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
    const scanned = yield* runQuery(
      DatabaseOperation.ReadBehaviorComparison,
      () =>
        db
          .select({
            deploymentId: deploymentReceipts.deploymentId,
            receivedAt: deploymentReceipts.receivedAt,
          })
          .from(deploymentReceipts)
          .where(
            and(
              eq(deploymentReceipts.projectId, projectId),
              eq(deploymentReceipts.bindingId, query.bindingId),
            ),
          )
          .orderBy(
            desc(deploymentReceipts.receivedAt),
            desc(deploymentReceipts.deploymentId),
          )
          .limit(13),
    )
    const scanTruncated = scanned.length > 12
    const considered = scanTruncated ? scanned.slice(0, 12) : scanned
    const newest = considered[0]?.receivedAt.getTime()
    const latestDeploymentIds =
      newest === undefined
        ? []
        : considered
            .filter((receipt) => receipt.receivedAt.getTime() === newest)
            .map((receipt) => receipt.deploymentId)
    const cohortFor = (
      deploymentId: string,
      rows: readonly ClassifiedRun[],
    ): ReceiptCohort =>
      classifyReceiptCohort({
        deploymentIds: Array.dedupe([
          deploymentId,
          ...Array.getSomes(
            Array.map(rows, (row) =>
              row.otherDeploymentId
                ? Option.some(row.otherDeploymentId)
                : Option.none(),
            ),
          ),
        ]),
        latestDeploymentIds,
        scanTruncated,
      })
    const beforeCohort = cohortFor(before.deploymentId, beforeRead.rows)
    const afterCohort = cohortFor(after.deploymentId, afterRead.rows)
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
      ...(beforeCohort.receiptClass === "mixed-receipts" ||
      afterCohort.receiptClass === "mixed-receipts"
        ? ["mixed-receipts"]
        : []),
      ...(beforeCohort.classMayBeIncomplete || afterCohort.classMayBeIncomplete
        ? ["receipt-scan-truncated"]
        : []),
    ]
    const withhold = limitations.length > 0
    const exampleOf = (
      runId: string,
      eventId: string,
    ): BehaviorComparisonExample => ({
      runId,
      observationEventId: eventId,
      signalEventId: eventId,
    })
    const described = (
      summary: ReturnType<typeof summarize>,
      rows: readonly ClassifiedRun[],
      deploymentId: string,
      cohort: ReceiptCohort,
    ): BehaviorComparisonCohort => {
      const primary = Array.getSomes(
        Array.map(eligible(rows), (row) =>
          row.observationEventId
            ? Option.some(exampleOf(row.runId, row.observationEventId))
            : Option.none(),
        ),
      ).slice(0, 2)
      const other = Array.getSomes(
        Array.map(rows, (row) =>
          row.otherObservationEventId &&
          row.otherDeploymentId &&
          row.otherArtifactDigest
            ? Option.some({
                artifactDigest: row.otherArtifactDigest,
                deploymentId: row.otherDeploymentId,
                example: exampleOf(row.runId, row.otherObservationEventId),
              })
            : Option.none(),
        ),
      )
      const otherGroups = Array.reduce(
        other,
        [] as BehaviorComparisonCohort["examplesByArtifact"][number][],
        (groups, item) => {
          const index = groups.findIndex(
            (group) => group.artifactDigest === item.artifactDigest,
          )
          if (index < 0) {
            return [
              ...groups,
              {
                artifactDigest: item.artifactDigest,
                deploymentId: item.deploymentId,
                examples: [item.example],
              },
            ]
          }
          const current = groups[index]
          if (!current || current.examples.length >= 2) {
            return groups
          }
          return Array.map(groups, (group, groupIndex) =>
            groupIndex === index
              ? { ...group, examples: [...group.examples, item.example] }
              : group,
          )
        },
      )
      return {
        ...summary,
        receiptCohort: cohort,
        rate:
          withhold || summary.eligibleRuns === 0
            ? null
            : {
                handledError:
                  summary.counts.handledError.total / summary.eligibleRuns,
                fallback: summary.counts.fallback.total / summary.eligibleRuns,
                partialOutcome:
                  summary.counts.partialOutcome.total / summary.eligibleRuns,
                normalPath:
                  summary.counts.normalPath.total / summary.eligibleRuns,
              },
        examplesByArtifact: [
          {
            artifactDigest: summary.artifactDigest,
            deploymentId,
            examples: primary,
          },
          ...otherGroups,
        ],
      }
    }
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
      before: described(
        baseline,
        beforeRead.rows,
        before.deploymentId,
        beforeCohort,
      ),
      after: described(
        successor,
        afterRead.rows,
        after.deploymentId,
        afterCohort,
      ),
      ...(drilldown ? { drilldown } : {}),
    }
  },
)
