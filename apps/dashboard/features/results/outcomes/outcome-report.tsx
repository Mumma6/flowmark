"use client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import Link from "next/link"
import { InsightInvestigationHandoff } from "../../runs/handoff/insight-investigation-handoff"
import type { useBusinessOutcomes } from "./use-business-outcomes"
import type { BusinessOutcomesProps } from "./business-outcomes-model"

export function OutcomeReport({
  selectedRevision,
  field,
  after,
  before,
  validDates,
  insights,
  input,
  evidence,
  workflow,
}: Pick<
  ReturnType<typeof useBusinessOutcomes>,
  | "selectedRevision"
  | "field"
  | "after"
  | "before"
  | "validDates"
  | "insights"
  | "input"
  | "evidence"
> &
  Pick<BusinessOutcomesProps, "workflow">) {
  return (
    <>
      {" "}
      {insights.data && !insights.error && (
        <>
          <p className="text-sm text-muted-foreground">
            Definition {selectedRevision} · {field?.label} · reported{" "}
            {field?.unit ?? "items"} across runs, not unique entities. Current{" "}
            {after} → {before}; previous{" "}
            {input.previousStartedAfter.slice(0, 10)} → {after}. Late terminal
            evidence can change a start cohort. Only compatible finished
            observations enter field totals. Unknown values remain separate.
          </p>
          <p className="text-sm">
            Release comparison:{" "}
            {insights.data.releaseComparison.available
              ? "Available for the selected definition; each release has at least five known observations. Differences are descriptive, not causal."
              : insights.data.releaseComparison.reason}
          </p>
          <InsightInvestigationHandoff
            workflow={workflow}
            selectedRevision={selectedRevision}
            validDates={validDates}
            field={field}
            input={input}
            insights={insights.data}
          />
          {insights.data.windows
            .filter(
              (window) =>
                !window.scope.startsWith("release") ||
                insights.data?.releaseComparison.available,
            )
            .map((window) => (
              <section
                key={window.scope}
                className="space-y-3 border-t pt-4"
                aria-label={`${window.scope} business cohort`}
              >
                <h3 className="font-medium">
                  {window.scope === "releaseA"
                    ? `Release ${input.releaseA}`
                    : window.scope === "releaseB"
                      ? `Release ${input.releaseB}`
                      : window.scope}{" "}
                  · {window.totalRuns} started runs
                </h3>
                <p className="text-sm">
                  Finished {window.finishedRuns}; technical failures{" "}
                  {window.failedRuns}; no terminal outcome {window.openRuns}.
                  Field coverage {window.knownRuns}/{window.finishedRuns}{" "}
                  finished runs: incompatible/missing revision{" "}
                  {window.incompatibleRevision}, missing result{" "}
                  {window.missingResult}, missing field {window.missingField},
                  wrong type {window.wrongType}, unknown category{" "}
                  {window.unknownCategory}.
                </p>
                {window.knownRuns < 5 && (
                  <p className="text-sm text-muted-foreground">
                    Small sample: fewer than five known observations. No
                    regression conclusion is supported.
                  </p>
                )}
                <p className="text-sm">
                  Reported total:{" "}
                  {window.total ?? "Unknown / no numeric observations"}.{" "}
                  {window.knownRuns} known field observations; absent values are
                  excluded, never zero-filled.
                </p>
                {input.numerator && (
                  <p className="text-sm">
                    Weighted ratio:{" "}
                    {window.ratio.value === null
                      ? "Unavailable (zero denominator or no jointly known observations)"
                      : window.ratio.value.toPrecision(5)}{" "}
                    = {window.ratio.numerator ?? "unknown"} /{" "}
                    {window.ratio.denominator ?? "unknown"}, across{" "}
                    {window.ratio.knownRuns} jointly valid finished runs.
                  </p>
                )}
                <Link className="text-sm underline" href={evidence(window)}>
                  Explore finished cohort
                </Link>
                {field?.kind === "count" && (
                  <Link
                    className="ml-3 text-sm underline"
                    href={evidence(window, {
                      resultSelection: { operator: "gte", value: 0 },
                    })}
                  >
                    Contributing count observations
                  </Link>
                )}
                {input.numerator && (
                  <Link
                    className="ml-3 text-sm underline"
                    href={evidence(window, { ratio: true })}
                  >
                    Contributing ratio observations
                  </Link>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reported outcome</TableHead>
                      <TableHead>Runs / finished runs</TableHead>
                      <TableHead>Evidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {window.outcomes.map((outcome) => (
                      <TableRow key={outcome.value}>
                        <TableCell>{outcome.value}</TableCell>
                        <TableCell>
                          {outcome.runs} / {window.finishedRuns}
                        </TableCell>
                        <TableCell>
                          <Link
                            className="underline"
                            href={evidence(window, {
                              outcome: outcome.value,
                            })}
                          >
                            Contributing runs
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-sm text-muted-foreground">
                  Missing canonical outcome: {window.missingOutcome}. Other
                  outcomes outside the top 20: {window.otherOutcomeRuns}.
                  Technical completion does not prove business accomplishment.
                </p>
                {window.categories.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Declared category/reason</TableHead>
                        <TableHead>Known runs / field observations</TableHead>
                        <TableHead>Reported total</TableHead>
                        <TableHead>Evidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {window.categories.map((category) => (
                        <TableRow key={category.value}>
                          <TableCell>{category.value}</TableCell>
                          <TableCell>
                            {category.runs} / {window.knownRuns}
                          </TableCell>
                          <TableCell>
                            {category.total ?? "Not a count / unknown"}
                          </TableCell>
                          <TableCell>
                            <Link
                              className="underline"
                              href={evidence(window, {
                                resultSelection:
                                  field?.kind === "category"
                                    ? {
                                        operator: "eq",
                                        value: category.value,
                                      }
                                    : {
                                        operator: "gte",
                                        value: 0,
                                        reason: category.value,
                                      },
                              })}
                            >
                              Contributing runs
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <details>
                  <summary className="cursor-pointer text-sm">
                    Daily start cohorts · UTC · same definition/coverage rules
                  </summary>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Known field / finished runs</TableHead>
                        <TableHead>Reported total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {window.daily.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{day.date}</TableCell>
                          <TableCell>
                            {day.knownRuns} / {day.finishedRuns}
                          </TableCell>
                          <TableCell>
                            {day.total ?? "Unknown / not numeric"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              </section>
            ))}
          {!insights.data.releaseComparison.available &&
            insights.data.windows
              .filter((window) => window.scope.startsWith("release"))
              .map((window) => (
                <p key={window.scope} className="text-sm">
                  {window.scope}: {window.knownRuns}/{window.finishedRuns}{" "}
                  known; {window.incompatibleRevision} incompatible/missing
                  revisions.
                </p>
              ))}
        </>
      )}{" "}
    </>
  )
}
