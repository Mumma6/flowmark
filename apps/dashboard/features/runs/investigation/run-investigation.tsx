"use client"

import { Alert, AlertDescription, AlertTitle } from "@flowmark/ui"
import { Option } from "effect"
import { useSearchParams } from "next/navigation"
import { PageSections } from "../../shared/page-sections"
import { runSelectionQueryKey } from "./investigation-selection"
import { useProject } from "../../projects/project-context"
import { buildInvestigation } from "./investigation-model"
import type { RunInvestigationProps } from "./investigation-types"
import { useRunInvestigation } from "./use-run-investigation"
import { SummarySection } from "./sections/summary-section"
import { OutcomeSection } from "./sections/outcome-section"
import { TimelineSection } from "./sections/timeline-section"
import { ContextSection } from "./sections/context-section"
import { CompareSection } from "./sections/compare-section"
import { RelatedSection } from "./sections/related-section"
import { ConfirmationsSection } from "./sections/confirmations-section"
import { HandoffSection } from "./sections/handoff-section"

export function RunInvestigation(props: RunInvestigationProps) {
  const params = useSearchParams()
  const { current } = useProject()
  return (
    <RunInvestigationContent
      key={`${props.runId}:${current?.id ?? "pending"}:${params.get(runSelectionQueryKey) ?? ""}`}
      {...props}
    />
  )
}

function RunInvestigationContent({
  runId,
  events,
  comparison,
  comparisonLoading = false,
  comparisonError,
  contextual = false,
}: RunInvestigationProps) {
  const {
    source,
    roundTrip,
    eventsPage,
    operationsPage,
    expectationsPage,
    relatedPage,
    selectionTab,
    linkedEventId,
    evidenceSelection,
    setEvidenceSelection,
    timelineView,
    setTimelineView,
  } = useRunInvestigation({ runId, events })
  const model = buildInvestigation(events)
  if (Option.isNone(model)) {
    return null
  }
  const {
    first,
    context,
    failure,
    completed,
    state,
    progress,
    reportedResult,
    lastReport,
    snapshot,
    errors,
    operations,
  } = model.value
  return (
    <div className="grid min-w-0 gap-6">
      {roundTrip._tag === "Rejected" ? (
        <Alert>
          <AlertTitle>Selection not applied</AlertTitle>
          <AlertDescription>{roundTrip.message}</AlertDescription>
        </Alert>
      ) : null}
      <PageSections
        compact={contextual}
        history={contextual ? "replace" : "push"}
        label="Run investigation sections"
        defaultValue={linkedEventId ? "timeline" : (selectionTab ?? "summary")}
        sections={[
          {
            value: "summary",
            label: "Run summary",
            description:
              "Start with this execution’s status and reported highlights. Inspect a milestone, use the tabs for more evidence, then take an investigation summary back to your application.",
            content: (
              <SummarySection
                source={source}
                first={first}
                snapshot={snapshot}
                runId={runId}
                events={events}
                contextual={contextual}
              />
            ),
          },
          {
            value: "outcome",
            label: "Reported results",
            description:
              "Check the final reported result separately from technical completion. Use the timeline to inspect how the execution reached this outcome.",
            content: (
              <OutcomeSection
                first={first}
                failure={failure}
                completed={completed}
                state={state}
                progress={progress}
                reportedResult={reportedResult}
                lastReport={lastReport}
                errors={errors}
                operations={operations}
                events={events}
              />
            ),
          },
          {
            value: "timeline",
            label: "Timeline",
            description:
              "Follow events in order. Expand an event for its payload, or switch to Operations to inspect recorded durations and gaps.",
            content: (
              <TimelineSection
                eventsPage={eventsPage}
                operationsPage={operationsPage}
                evidenceSelection={evidenceSelection}
                setEvidenceSelection={setEvidenceSelection}
                timelineView={timelineView}
                setTimelineView={setTimelineView}
                runId={runId}
                events={events}
              />
            ),
          },
          {
            value: "context",
            label: "Context",
            description:
              "Use the recorded environment, release and business identifiers to find the same execution in your application logs.",
            content: <ContextSection first={first} context={context} />,
          },
          {
            value: "compare",
            label: "Compare",
            description:
              "Compare this execution with another recorded run of the same workflow. Differences are evidence to investigate, not a confirmed cause.",
            content: (
              <CompareSection
                source={source}
                comparison={comparison}
                comparisonLoading={comparisonLoading}
                comparisonError={comparisonError}
                contextual={contextual}
              />
            ),
          },
          {
            value: "related",
            label: "Related runs",
            description:
              "Follow explicit application-declared links to earlier attempts, parents or runs sharing a correlation. Each run has its own status and result.",
            content: (
              <RelatedSection
                source={source}
                relatedPage={relatedPage}
                first={first}
                runId={runId}
                contextual={contextual}
              />
            ),
          },
          {
            value: "confirmations",
            label: "Confirmations",
            description:
              "Inspect the confirmations this application expected and any observed resolutions. A completed run can still be waiting for a confirmation.",
            content: (
              <ConfirmationsSection
                source={source}
                expectationsPage={expectationsPage}
                runId={runId}
                contextual={contextual}
              />
            ),
          },
          {
            value: "handoff",
            label: "Take findings forward",
            description:
              "Finish with a factual record of this execution. Copy the investigation summary for an issue or application-log search, and add your own diagnosis after checking the evidence.",
            content: (
              <HandoffSection
                runId={runId}
                events={events}
                contextual={contextual}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
