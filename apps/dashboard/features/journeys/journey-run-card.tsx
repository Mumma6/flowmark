"use client"

import type {
  JourneyEdge,
  JourneyNode,
  JourneyRunReference,
} from "@flowmarkdev/core"
import { journeyParentDescription } from "./journey-presentation"
import Link from "next/link"
import { ArrowUpRight, GitBranch } from "lucide-react"
import { runInvestigationPath } from "../runs/investigation/investigation-navigation"
import { StatusBadge } from "../shared/dashboard-components"
import { formatTimestamp } from "../shared/format"

function EvidenceLink({
  run,
  from,
  view,
  children,
}: {
  run: JourneyRunReference
  from: string
  view?: string
  children: React.ReactNode
}) {
  const href = runInvestigationPath(run.id, from, view)
  return (
    <Link
      href={href}
      scroll={false}
      data-run-id={run.id}
      className="inline-flex min-h-9 min-w-0 items-center gap-1.5 break-all text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onNavigate={(event) => {
        event.preventDefault()
        window.history.pushState(null, "", href)
      }}
    >
      {children}
      <ArrowUpRight aria-hidden="true" className="size-3 shrink-0" />
    </Link>
  )
}

export function JourneyRunCard({
  node,
  from,
  edges,
}: {
  node: JourneyNode
  from: string
  edges: readonly JourneyEdge[]
}) {
  return (
    <li className="grid min-w-0 gap-3 rounded-lg border border-border bg-background/50 p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4
            id={`journey-evidence-${node.id}`}
            tabIndex={-1}
            className="break-all font-mono text-sm"
          >
            <EvidenceLink run={node} from={from}>
              {node.workflow}
            </EvidenceLink>
          </h4>
          <p className="break-all font-mono text-[11px] text-muted-foreground">
            {node.externalId}
          </p>
        </div>
        <StatusBadge status={node.status} />
      </div>
      <dl className="grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Reported business outcome</dt>
          <dd className="mt-1 break-all">{node.outcome ?? "Not reported"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            Started · link distance {node.depth}
          </dt>
          <dd className="mt-1">{formatTimestamp(node.startedAt)} UTC</dd>
        </div>
      </dl>
      <div className="grid gap-1 border-t border-border pt-2">
        <p className="text-xs text-muted-foreground">
          {journeyParentDescription(node, edges)}
        </p>
        {node.parent.matches.map((parent) => (
          <div key={parent.id}>
            <EvidenceLink run={parent} from={from}>
              {parent.workflow} · {parent.externalId}
            </EvidenceLink>
          </div>
        ))}
        {node.retry.state !== "absent" ? (
          <div className="grid gap-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GitBranch aria-hidden="true" className="size-3" />
              {node.retry.state === "missing"
                ? "Retry reported; original attempt is missing from recorded evidence."
                : "Separate retry attempt of"}
            </p>
            {node.retry.matches.map((original) => (
              <EvidenceLink key={original.id} run={original} from={from}>
                {original.workflow} · {original.externalId}
              </EvidenceLink>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <EvidenceLink run={node} from={from} view="outcome">
          Reported results
        </EvidenceLink>
        <EvidenceLink run={node} from={from} view="confirmations">
          Confirmations
        </EvidenceLink>
      </div>
    </li>
  )
}
