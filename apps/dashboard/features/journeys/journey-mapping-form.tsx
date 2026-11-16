"use client"

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flowmark/ui"
import { Array, Result } from "effect"
import { DataState } from "../shared/dashboard-components"
import type { JourneySelection } from "./journey-selection"
import { useJourneyMapping } from "./use-journey-mapping"

export function JourneyMappingForm({
  selection,
  onApply,
}: {
  selection: JourneySelection
  onApply: (selection: JourneySelection) => void
}) {
  const { snapshot, namespaces, setNamespaces, fields, parsed, valid, update } =
    useJourneyMapping(selection)
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) {
          Result.match(parsed, {
            onFailure: () => undefined,
            onSuccess: (query) =>
              onApply({ ...selection, stage: "evidence", query }),
          })
        }
      }}
    >
      <p className="max-w-2xl text-xs leading-6 text-muted-foreground">
        Choose the processes and declared reference fields that describe this
        journey. Matching values need an explicit run link. Shared batches do
        not add other referrals.
      </p>
      <DataState
        pending={snapshot.isPending}
        error={snapshot.error}
        retry={() => void snapshot.refetch()}
      />
      {namespaces.map((namespace, index) => {
        const processNames = Array.dedupe([
          namespace.workflow,
          ...Array.map(
            snapshot.data?.workflows ?? [],
            (workflow) => workflow.name,
          ),
        ]).filter(Boolean)
        const lookupFields = Array.filter(
          fields[index]?.data ?? [],
          (field) => field.role === "lookup",
        )
        return (
          <fieldset
            key={index}
            className="grid min-w-0 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <legend className="px-1 text-xs text-muted-foreground">
              {index === 0 ? "Starting process" : `Linked process ${index}`}
            </legend>
            <label className="grid min-w-0 gap-1.5 text-xs">
              Process
              {index === 0 ? (
                <Input
                  readOnly
                  value={namespace.workflow}
                  className="text-xs"
                />
              ) : (
                <Select
                  required
                  items={{
                    "": "Choose process",
                    ...Object.fromEntries(
                      processNames.map((name) => [name, name]),
                    ),
                  }}
                  value={namespace.workflow}
                  onValueChange={(next) => update(index, next, "")}
                >
                  <SelectTrigger aria-label={`Process ${index + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Choose process</SelectItem>
                    {processNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs">
              Reference field
              <Select
                required
                disabled={
                  index === 0 ||
                  !namespace.workflow ||
                  fields[index]?.isPending ||
                  fields[index]?.isError
                }
                items={{
                  "": "Choose declared lookup",
                  ...Object.fromEntries(
                    lookupFields.map((field) => [field.key, field.key]),
                  ),
                }}
                value={namespace.key}
                onValueChange={(next) =>
                  update(index, namespace.workflow, next)
                }
              >
                <SelectTrigger aria-label={`Reference field ${index + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Choose declared lookup</SelectItem>
                  {lookupFields.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      {field.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {index > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="self-end"
                onClick={() =>
                  setNamespaces((current) =>
                    Array.filter(current, (_, at) => at !== index),
                  )
                }
              >
                Remove<span className="sr-only"> process {index + 1}</span>
              </Button>
            ) : null}
            {namespace.workflow ? (
              <div className="sm:col-span-3">
                <DataState
                  pending={fields[index]?.isPending ?? false}
                  error={fields[index]?.error}
                  retry={() => void fields[index]?.refetch()}
                />
                {!fields[index]?.isPending &&
                !fields[index]?.isError &&
                !Array.some(
                  fields[index]?.data ?? [],
                  (field) => field.role === "lookup",
                ) ? (
                  <p className="text-xs text-muted-foreground">
                    No declared lookup fields available for this process.
                  </p>
                ) : null}
                {!fields[index]?.isPending &&
                !fields[index]?.isError &&
                namespace.key &&
                !Array.some(
                  fields[index]?.data ?? [],
                  (field) =>
                    field.role === "lookup" && field.key === namespace.key,
                ) ? (
                  <p className="text-xs text-muted-foreground">
                    The selected reference field is no longer available as a
                    declared lookup. Open another exact reference or choose an
                    available field.
                  </p>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={
            namespaces.length >= 8 || snapshot.isPending || snapshot.isError
          }
          onClick={() =>
            setNamespaces((current) => [...current, { workflow: "", key: "" }])
          }
        >
          Add linked process
        </Button>
        <Button type="submit" disabled={!valid}>
          Follow linked evidence
        </Button>
      </div>
      {Result.isFailure(parsed) ? (
        <p className="text-xs text-muted-foreground">
          Choose one reference field per process, with no duplicate processes
          (up to eight).
        </p>
      ) : null}
    </form>
  )
}
