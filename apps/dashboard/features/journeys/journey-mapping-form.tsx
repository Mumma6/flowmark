"use client"

import { Button, Input, NativeSelect, NativeSelectOption } from "@flowmark/ui"
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
      {namespaces.map((namespace, index) => (
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
              <Input readOnly value={namespace.workflow} className="text-xs" />
            ) : (
              <NativeSelect
                required
                aria-label={`Process ${index + 1}`}
                value={namespace.workflow}
                onChange={(event) => update(index, event.target.value, "")}
              >
                <NativeSelectOption value="">Choose process</NativeSelectOption>
                {Array.dedupe([
                  namespace.workflow,
                  ...Array.map(
                    snapshot.data?.workflows ?? [],
                    (workflow) => workflow.name,
                  ),
                ])
                  .filter(Boolean)
                  .map((name) => (
                    <NativeSelectOption key={name} value={name}>
                      {name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            )}
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs">
            Reference field
            <NativeSelect
              required
              aria-label={`Reference field ${index + 1}`}
              value={namespace.key}
              disabled={
                index === 0 ||
                !namespace.workflow ||
                fields[index]?.isPending ||
                fields[index]?.isError
              }
              onChange={(event) =>
                update(index, namespace.workflow, event.target.value)
              }
            >
              <NativeSelectOption value="">
                Choose declared lookup
              </NativeSelectOption>
              {Array.filter(
                fields[index]?.data ?? [],
                (field) => field.role === "lookup",
              ).map((field) => (
                <NativeSelectOption key={field.key} value={field.key}>
                  {field.key}
                </NativeSelectOption>
              ))}
            </NativeSelect>
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
      ))}
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
