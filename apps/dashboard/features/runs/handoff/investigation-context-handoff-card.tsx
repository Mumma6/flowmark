"use client"

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { Check } from "lucide-react"
import { CopyButton } from "../../shared/dashboard-components"
import { separateObservationNotice } from "../investigation/connected-retrieval"
import type { SafeRunContextHandoff } from "./safe-run-context-handoff"
import { useRunHandoffCopyState } from "./use-run-handoff-copy-state"

export function InvestigationContextHandoffCard({
  handoff,
  title = "Preview investigation context",
  description = handoff.mode === "connected"
    ? "Copy the exact tool arguments for an agent that already has read access. This text does not grant access or change the selection."
    : "Factual summary for your agent with deliberate redaction. Copy only when you intend to paste it elsewhere. Remote MCP tools are not available — use this text and source links, not unimplemented tool calls.",
  compact = false,
}: {
  handoff: SafeRunContextHandoff
  title?: string
  description?: string
  compact?: boolean
}) {
  const { contextCopied, markContextCopied } = useRunHandoffCopyState()
  return (
    <Card className={compact ? "border-dashed shadow-none" : undefined}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className={compact ? "text-base" : undefined}>
          {title}
        </CardTitle>
        {!compact ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm leading-6 text-muted-foreground">
          {separateObservationNotice}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <CopyButton
            label="Copy investigation context"
            variant={compact ? "outline" : "default"}
            value={handoff.preview}
            onCopied={markContextCopied}
          />
          {contextCopied ? (
            <Badge variant="success" className="text-[10px]">
              <span className="inline-flex items-center gap-1">
                <Check aria-hidden="true" className="size-3" />
                Copied locally
              </span>
            </Badge>
          ) : null}
        </div>
        {!compact ? (
          <ul className="grid gap-1 text-sm leading-6 text-muted-foreground">
            {handoff.omissions.map((item) => (
              <li key={item}>Omitted: {item}</li>
            ))}
          </ul>
        ) : null}
        <pre
          className={
            compact
              ? "sr-only"
              : "max-h-96 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-4 text-sm leading-7"
          }
        >
          {handoff.preview}
        </pre>
      </CardContent>
    </Card>
  )
}
