"use client"

import { RunSnapshot } from "@flowmark/ui"
import { CopyButton, ViewLink } from "../../../shared/dashboard-components"
import { runInvestigationPath } from "../investigation-navigation"
import {
  buildRunExport,
  buildTimelineExport,
  stringifyExport,
} from "../../handoff/run-export"
import type { InvestigationSectionProps } from "../investigation-types"

export function SummarySection({
  source,
  first,
  snapshot,
  runId,
  events,
  contextual,
}: Pick<
  InvestigationSectionProps,
  "source" | "first" | "snapshot" | "runId" | "events" | "contextual"
>) {
  return (
    <>
      {snapshot && (
        <div
          className={
            contextual
              ? ""
              : "[&_p]:text-sm [&_dt]:text-sm [&_dd+dd]:text-sm [&_h3]:text-base [&_pre]:text-sm [&_button_span]:text-sm"
          }
        >
          <RunSnapshot
            {...snapshot}
            actions={
              <>
                <ViewLink
                  href={`/workflows/${encodeURIComponent(first.workflow)}`}
                >
                  View workflow
                </ViewLink>
                {(() => {
                  const runExport = buildRunExport(events)
                  const timelineExport = buildTimelineExport(events)
                  return (
                    <>
                      {runExport && (
                        <CopyButton
                          label="Copy run JSON"
                          value={stringifyExport(runExport)}
                        />
                      )}
                      {timelineExport && (
                        <CopyButton
                          label="Copy timeline JSON"
                          value={stringifyExport(timelineExport)}
                        />
                      )}
                    </>
                  )
                })()}
              </>
            }
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <ViewLink
          href={runInvestigationPath(runId, source, "timeline")}
          replace={contextual}
        >
          Inspect the timeline
        </ViewLink>
        <ViewLink
          href={runInvestigationPath(runId, source, "handoff")}
          replace={contextual}
        >
          Take findings forward
        </ViewLink>
      </div>
    </>
  )
}
