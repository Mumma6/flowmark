"use client"

import { Button } from "@flowmark/ui"
import { Result } from "effect"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import type {
  LinkedComparisonSelection,
  LinkedCoverage,
} from "@flowmarkdev/core"
import { SaveInvestigation } from "../../investigations/save-investigation"
import { useProject } from "../../projects/project-context"
import { DataState } from "../../shared/dashboard-components"
import { LinkedComparisonForm } from "./linked-comparison-form"
import { LinkedComparisonResults } from "./linked-comparison-results"
import { LinkedEvidence } from "./linked-evidence"
import { useLinkedComparisonQueries } from "./linked-query"
import {
  buildLinkedQuery,
  linkedComparisonLocation,
  linkedDraft,
  linkedQueryKey,
  readLinkedSelection,
  type LinkedComparisonDraft,
} from "./linked-selection"

export function LinkedProcessComparison() {
  const { current } = useProject()
  const params = useSearchParams()
  const encoded = params.get(linkedQueryKey)
  const questionKey = current
    ? Result.match(readLinkedSelection(encoded, current.id), {
        onFailure: () => encoded,
        onSuccess: (selection) =>
          selection ? JSON.stringify(selection.query) : "new",
      })
    : "no-project"
  return current ? (
    <Comparison
      key={`${current.id}:${questionKey}`}
      projectId={current.id}
      encoded={encoded}
    />
  ) : (
    <p role="status" className="text-sm">
      Select a project to compare linked executions.
    </p>
  )
}

function Comparison({
  projectId,
  encoded,
}: {
  projectId: string
  encoded: string | null
}) {
  const router = useRouter()
  const parsed = readLinkedSelection(encoded, projectId)
  const selection = Result.getOrElse(parsed, () => null)
  const [draft, setDraft] = useState(() => linkedDraft(selection?.query))
  const [validation, setValidation] = useState("")
  const { analysis, evidence } = useLinkedComparisonQueries(selection)
  const navigate = (next: LinkedComparisonSelection) =>
    router.push(linkedComparisonLocation(next), { scroll: false })
  const submit = () => {
    setValidation("")
    Result.match(buildLinkedQuery(draft), {
      onFailure: setValidation,
      onSuccess: (query) => {
        const next = {
          version: 1 as const,
          kind: "linked-comparison" as const,
          projectId,
          query,
        }
        if (
          selection &&
          JSON.stringify(selection.query) === JSON.stringify(query)
        ) {
          void analysis.refetch()
        }
        if (JSON.stringify(next) !== encoded) {
          navigate(next)
        }
      },
    })
  }
  const update = (change: Partial<LinkedComparisonDraft>) => {
    setDraft((current) => ({ ...current, ...change }))
    setValidation("")
  }
  const inspect = (
    scope: "current" | "previous",
    coverage?: LinkedCoverage,
  ) => {
    if (selection) {
      navigate({ ...selection, evidence: { scope, coverage } })
    }
  }
  const restartEvidence = () => {
    if (selection?.evidence) {
      navigate({
        ...selection,
        evidence: {
          scope: selection.evidence.scope,
          coverage: selection.evidence.coverage,
        },
      })
    }
  }
  return (
    <div className="grid min-w-0 gap-5">
      {Result.isFailure(parsed) && (
        <p role="alert" className="text-sm">
          {parsed.failure}
        </p>
      )}
      <LinkedComparisonForm
        draft={draft}
        update={update}
        submit={submit}
        validation={validation}
        fetching={analysis.isFetching}
      />
      {selection && (
        <>
          <SaveInvestigation selection={selection} />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={analysis.isFetching}
              onClick={() => void analysis.refetch()}
            >
              Refresh displayed comparison
            </Button>
            <p className="text-xs text-muted-foreground">
              Selection links carry this question and project, never access
              credentials. A recipient must have project access.
            </p>
          </div>
          <DataState
            pending={analysis.isPending}
            error={analysis.error}
            retry={() => void analysis.refetch()}
          />
          {analysis.data && (
            <>
              {analysis.error && (
                <p role="status" className="text-sm">
                  Refresh failed. Showing the previous successful comparison.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Last successful read:{" "}
                {new Date(analysis.dataUpdatedAt).toISOString()}
              </p>
              <LinkedComparisonResults
                report={analysis.data}
                inspect={inspect}
              />
            </>
          )}
          {selection.evidence && (
            <section
              aria-label="Selected linked execution evidence"
              className="grid min-w-0 gap-3"
            >
              <DataState
                pending={evidence.isPending}
                error={evidence.error}
                retry={() => void evidence.refetch()}
              />
              {evidence.error && selection.evidence.cursor && (
                <Button
                  className="justify-self-start"
                  variant="outline"
                  onClick={restartEvidence}
                >
                  Restart evidence paging
                </Button>
              )}
              {evidence.data && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {evidence.error
                      ? "Refresh failed; showing the previous successful page."
                      : "Evidence last read"}{" "}
                    {new Date(evidence.dataUpdatedAt).toISOString()}
                  </p>
                  <LinkedEvidence
                    page={evidence.data}
                    selection={selection}
                    navigate={navigate}
                  />
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
