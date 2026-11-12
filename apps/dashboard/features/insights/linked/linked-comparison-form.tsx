"use client"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@flowmark/ui"
import type { LinkedComparisonDraft } from "./linked-selection"

const processFields = [
  ["upstreamWorkflow", "Upstream workflow", "patient.match"],
  ["upstreamRevision", "Upstream revision", "meridian-v1"],
  ["downstreamWorkflow", "Downstream workflow", "appointment.book"],
  ["downstreamRevision", "Downstream revision", "meridian-v1"],
] as const
const windows = [
  ["previousStartedAfter", "Previous start (UTC)"],
  ["previousStartedBefore", "Previous end, exclusive (UTC)"],
  ["currentStartedAfter", "Current start (UTC)"],
  ["currentStartedBefore", "Current end, exclusive (UTC)"],
] as const
const optionalFields = [
  ["businessKey", "Upstream category key", "provider"],
  ["businessValue", "Category value", "cedar-health"],
  ["releaseA", "Previous downstream release", "release-a"],
  ["releaseB", "Current downstream release", "release-b"],
] as const

export function LinkedComparisonForm({
  draft,
  update,
  submit,
  validation,
  fetching,
}: {
  draft: LinkedComparisonDraft
  update: (change: Partial<LinkedComparisonDraft>) => void
  submit: () => void
  validation: string
  fetching: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare linked executions</CardTitle>
        <CardDescription>
          Compare a downstream reported result using the start window and
          optional category of its upstream process. Each run is an attempt;
          retries remain separate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid min-w-0 gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">
              Processes and declared revisions
            </legend>
            {processFields.map(([key, label, placeholder]) => (
              <label key={key} className="grid min-w-0 gap-1.5 text-sm">
                {label}
                <Input
                  required
                  maxLength={key.endsWith("Revision") ? 64 : 200}
                  value={draft[key]}
                  placeholder={placeholder}
                  onChange={(event) => update({ [key]: event.target.value })}
                />
              </label>
            ))}
          </fieldset>
          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">
              Downstream count fields
            </legend>
            <label className="grid min-w-0 gap-1.5 text-sm">
              Numerator path (JSON array)
              <Input
                required
                value={draft.numerator}
                maxLength={4096}
                placeholder='["confirmed"]'
                onChange={(event) => update({ numerator: event.target.value })}
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm">
              Denominator path (JSON array)
              <Input
                required
                value={draft.denominator}
                maxLength={4096}
                placeholder='["requested"]'
                onChange={(event) =>
                  update({ denominator: event.target.value })
                }
              />
            </label>
            <p className="text-xs leading-6 text-muted-foreground sm:col-span-2">
              Use declared aggregatable counts. Paths are explicit arrays, so a
              field containing a dot is distinct from a nested field. The ratio
              uses sums over the same known pairs.
            </p>
          </fieldset>
          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">
              Upstream start windows
            </legend>
            {windows.map(([key, label]) => (
              <label key={key} className="grid min-w-0 gap-1.5 text-sm">
                {label}
                <Input
                  type="datetime-local"
                  step="0.001"
                  required
                  value={draft[key]}
                  onChange={(event) => update({ [key]: event.target.value })}
                />
              </label>
            ))}
            <p className="text-xs leading-6 text-muted-foreground sm:col-span-2">
              Times are UTC. The previous window must end before the current
              starts; each is at most 31 days. A uniquely linked downstream run
              can start outside its upstream window.
            </p>
          </fieldset>
          <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">
              Optional configured context
            </legend>
            {optionalFields.map(([key, label, placeholder]) => (
              <label key={key} className="grid min-w-0 gap-1.5 text-sm">
                {label}
                <Input
                  maxLength={key === "businessValue" ? 256 : 128}
                  value={draft[key]}
                  placeholder={placeholder}
                  onChange={(event) => update({ [key]: event.target.value })}
                />
              </label>
            ))}
            <p className="text-xs leading-6 text-muted-foreground sm:col-span-2">
              Category/value apply to the upstream process. Releases apply to
              the sole downstream run after checking all linked attempts. Supply
              both fields in either pair, or leave both empty.
            </p>
          </fieldset>
          {validation && (
            <p role="alert" className="text-sm">
              {validation}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={fetching}>
              {fetching ? "Analyzing…" : "Analyze linked executions"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update({
                  upstreamWorkflow: "patient.match",
                  upstreamRevision: "meridian-v1",
                  downstreamWorkflow: "appointment.book",
                  downstreamRevision: "meridian-v1",
                  numerator: '["confirmed"]',
                  denominator: '["requested"]',
                  businessKey: "provider",
                  businessValue: "cedar-health",
                  releaseA: "",
                  releaseB: "",
                })
              }
            >
              Use Meridian fields
            </Button>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            Form edits apply only after analyzing. Choose windows that cover
            your retained evidence; loading example fields does not create data.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
