"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
} from "@flowmark/ui"
import { Result } from "effect"
import { GitBranch, X } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { useProject } from "../projects/project-context"
import { JourneyEvidence } from "./journey-evidence"
import { JourneyMappingForm } from "./journey-mapping-form"
import {
  journeyHref,
  journeyQueryKey,
  readJourneySelection,
  type JourneySelection,
} from "./journey-selection"

export function ReferenceJourney() {
  const params = useSearchParams()
  const { current } = useProject()
  const raw = params.get(journeyQueryKey)
  if (!current || raw === null) {
    return null
  }
  const close = () => {
    const next = new URLSearchParams(window.location.search)
    next.delete(journeyQueryKey)
    window.history.pushState(null, "", `/${next.size ? `?${next}` : ""}`)
  }
  return (
    <section
      aria-labelledby="journey-title"
      className="grid min-w-0 gap-5 rounded-xl border border-primary/30 bg-card p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="journey-title"
          tabIndex={-1}
          className="flex items-center gap-2 text-base font-medium"
        >
          <GitBranch aria-hidden="true" className="size-4 text-primary" />
          Reference journey
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close reference journey"
          onClick={close}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
      {Result.match(readJourneySelection(raw, current.id), {
        onFailure: (message) => (
          <Alert>
            <AlertTitle>Journey selection not applied</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ),
        onSuccess: (selection) => (
          <JourneyContent
            key={raw}
            selection={selection}
            source={`/?${params}`}
          />
        ),
      })}
    </section>
  )
}

function JourneyContent({
  selection,
  source,
}: {
  selection: JourneySelection
  source: string
}) {
  useEffect(() => {
    document.getElementById("journey-title")?.focus()
  }, [])
  const apply = (next: JourneySelection) =>
    window.history.pushState(null, "", journeyHref(source, next))
  const from = journeyHref(source, selection)
  return (
    <>
      <div className="grid min-w-0 gap-2">
        <p className="break-all font-mono text-sm">
          {selection.query.key} = {selection.query.value}
        </p>
        <div
          className="flex flex-wrap gap-1.5"
          aria-label="Journey reference mapping"
        >
          {selection.query.namespaces.map((namespace) => (
            <Badge
              key={namespace.workflow}
              variant="outline"
              className="max-w-full whitespace-normal break-all text-[10px]"
            >
              {namespace.workflow} / {namespace.key}
            </Badge>
          ))}
        </div>
      </div>
      <p className="text-xs leading-6 text-muted-foreground">
        Recorded linked evidence only. Downstream runs may be sampled; this is
        not a complete funnel or proof of business success. Explore filters
        below do not limit this reference journey.
      </p>
      {selection.stage === "configure" ? (
        <JourneyMappingForm selection={selection} onApply={apply} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => apply({ ...selection, stage: "configure" })}
            >
              Edit reference mapping
            </Button>
            {selection.query.anchorRunId ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  apply({
                    ...selection,
                    query: {
                      ...selection.query,
                      anchorRunId: undefined,
                      candidateCursor: undefined,
                      cursor: undefined,
                    },
                  })
                }
              >
                Choose starting execution again
              </Button>
            ) : null}
          </div>
          <JourneyEvidence selection={selection} from={from} onSelect={apply} />
        </>
      )}
    </>
  )
}
