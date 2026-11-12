"use client"

import { Badge, Button } from "@flowmark/ui"
import { getRunResultHighlights } from "../../runs/models/run-presentation"
import { useProject } from "../../projects/project-context"
import { useResultDeclarations } from "../queries"
import { declarationForRun, declaredResults } from "./result-presentation"

export function BusinessResult({
  workflow,
  outcome,
  result,
  properties,
  nonFinal = false,
}: {
  nonFinal?: boolean
  workflow: string
  outcome?: string | null
  result: Record<string, unknown> | null | undefined
  properties: Record<string, unknown> | null | undefined
}) {
  const { current } = useProject()
  const declarations = useResultDeclarations(
    current?.id ?? "",
    workflow,
    !!current,
  )
  const declaration = declarationForRun(declarations.data ?? [], properties)
  return (
    <div className="space-y-4">
      {nonFinal ? (
        <Badge variant="secondary">Non-final snapshot</Badge>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">Business outcome</p>
          <Badge variant="secondary">{outcome ?? "Not reported"}</Badge>
        </div>
      )}
      {workflow.startsWith("browser.") && (
        <p className="text-sm text-muted-foreground">
          Untrusted browser-reported evidence.
        </p>
      )}
      {declarations.isPending && current && (
        <p role="status">Loading result labels…</p>
      )}
      {declarations.error && (
        <p role="alert">
          Could not load result declarations.{" "}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void declarations.refetch()}
          >
            Retry
          </Button>
        </p>
      )}
      {declaration ? (
        <>
          <p className="text-sm text-muted-foreground">
            Definition revision: {declaration.revision}
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {declaredResults(result, declaration).map((field, index) => (
              <div key={index}>
                <dt className="text-sm text-muted-foreground">
                  {field.label}
                  {field.unit ? ` (${field.unit})` : ""}
                </dt>
                <dd className="text-sm">
                  {field.state !== "Reported"
                    ? field.state
                    : (field.value ??
                      (field.reasons.length === 0
                        ? "No reasons reported"
                        : null))}
                  {field.reasons.map(([reason, count]) => (
                    <div key={reason} className="flex justify-between gap-3">
                      <span>{reason}</span>
                      <span className="tabular-nums">{count}</span>
                    </div>
                  ))}
                  {field.omittedReasons > 0 && (
                    <p>{field.omittedReasons} more reasons in raw result</p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {getRunResultHighlights(result ?? {}).map((field) => (
            <div key={field.key}>
              <dt className="text-sm text-muted-foreground">{field.label}</dt>
              <dd className="text-sm">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
