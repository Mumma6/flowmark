"use client"

import { StudioEvidenceList } from "@flowmark/ui"
import { Array as EffectArray } from "effect"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { Run } from "../platform/api-types"
import { formatDuration, formatTimestamp } from "../shared/format"
import {
  readInspectorRunId,
  runInvestigationPath,
} from "../runs/investigation-navigation"
import {
  getRunResultHighlights,
  runStatusLabel,
} from "../runs/run-presentation"

export function ExploreRunList({ runs }: { runs: readonly Run[] }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const from = `${pathname}${params.size ? `?${params}` : ""}`
  return (
    <StudioEvidenceList
      runs={EffectArray.map(runs, (run) => ({
        id: run.id,
        workflow: run.workflow,
        externalId: run.externalId,
        status: runStatusLabel(run.status),
        outcome: run.outcome,
        untrusted: run.workflow.startsWith("browser."),
        highlights: getRunResultHighlights(run.result ?? {}).slice(0, 2),
        duration: formatDuration(run.durationMs),
        timestamp: `${formatTimestamp(run.startedAt)} UTC`,
        startedAt: run.startedAt,
      }))}
      renderLink={(run, props) => (
        <Link
          onNavigate={(event) => {
            if (!readInspectorRunId(`/runs/${encodeURIComponent(run.id)}`)) {
              return
            }
            event.preventDefault()
            window.history.pushState(
              null,
              "",
              runInvestigationPath(run.id, from),
            )
          }}
          href={runInvestigationPath(run.id, from)}
          data-run-id={run.id}
          scroll={false}
          {...props}
        />
      )}
    />
  )
}
