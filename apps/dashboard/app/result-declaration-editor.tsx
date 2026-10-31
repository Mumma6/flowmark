"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  NativeSelect,
} from "@flowmark/ui"
import { useTRPC } from "../lib/trpc"
import { useProject } from "./project-context"
import type { ResultDeclaration } from "./result-presentation"

type Field = {
  path: string
  label: string
  kind: "count" | "category" | "reasons"
  unit: string
  aggregate: boolean
  values: string
}
const blankField = (): Field => ({
  path: "",
  label: "",
  kind: "count",
  unit: "",
  aggregate: false,
  values: "",
})

export function ResultDeclarationEditor({ workflow }: { workflow: string }) {
  const { current } = useProject()
  return current ? (
    <ResultDeclarationForm
      key={`${current.id}:${workflow}`}
      projectId={current.id}
      workflow={workflow}
    />
  ) : null
}

function ResultDeclarationForm({
  workflow,
  projectId,
}: {
  workflow: string
  projectId: string
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [revision, setRevision] = useState("")
  const [fields, setFields] = useState<Field[]>([])
  const [validation, setValidation] = useState("")
  const declarations = useQuery(
    trpc.resultDeclarations.list.queryOptions({ projectId, workflow }),
  )
  const create = useMutation(
    trpc.resultDeclarations.create.mutationOptions({
      onSuccess: () => {
        setValidation("Saved immutable revision.")
        void queryClient.invalidateQueries({
          queryKey: trpc.resultDeclarations.list.queryKey(),
        })
      },
    }),
  )
  const updateField = (index: number, change: Partial<Field>) =>
    setFields((items) =>
      items.map((item, i) => (i === index ? { ...item, ...change } : item)),
    )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Result presentation</CardTitle>
        <CardDescription>
          Optional ordered result fields. Revisions are permanent. Use a new
          revision whenever meaning, units or categories change. Canonical
          outcomes require no setup. Aggregation is explicit: counts mean
          reported items across runs, never unique entities. Configure bounded
          categories/reasons before enabling aggregation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {declarations.isPending && <p role="status">Loading declarations…</p>}
        {declarations.error && (
          <p role="alert">
            Could not load declarations.{" "}
            <Button
              variant="outline"
              onClick={() => void declarations.refetch()}
            >
              Retry
            </Button>
          </p>
        )}
        {declarations.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No declared result fields yet.
          </p>
        )}
        {declarations.data?.map((item) => (
          <details key={item.revision}>
            <summary className="cursor-pointer text-sm">
              Revision {item.revision} · {item.fields.length} fields
            </summary>
            <ul className="pl-4 text-sm">
              {item.fields.map((field, i) => (
                <li key={i}>
                  {field.label} · {field.path.join(".")} · {field.kind}
                  {field.unit ? ` · ${field.unit}` : ""}
                  {field.aggregate ? " · Aggregatable" : ""}
                </li>
              ))}
            </ul>
          </details>
        ))}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            const declaration: ResultDeclaration = {
              revision,
              fields: fields.map((field) => ({
                path: field.path.split("."),
                label: field.label,
                kind: field.kind,
                aggregate: field.aggregate,
                ...(field.kind !== "count" && field.values.trim()
                  ? {
                      values: field.values
                        .split(",")
                        .map((value) => value.trim()),
                    }
                  : {}),
                ...(field.unit ? { unit: field.unit } : {}),
              })),
            }
            setValidation("")
            create.mutate({ projectId, workflow, declaration })
          }}
        >
          <label className="block space-y-1 text-sm">
            New definition revision
            <Input
              required
              maxLength={64}
              pattern="[a-z][a-z0-9_-]{0,63}"
              value={revision}
              onChange={(event) => setRevision(event.target.value)}
              placeholder="import-v1"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Set properties.definitionRevision on the original start to this
            revision. Runs without an explicit revision use the default result
            view. Context amendments do not change the selected revision.
          </p>
          {fields.map((field, index) => (
            <fieldset
              key={index}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-2"
            >
              <legend className="px-1 text-sm">Field {index + 1}</legend>
              <label className="text-sm">
                Result path
                <Input
                  required
                  value={field.path}
                  onChange={(event) =>
                    updateField(index, { path: event.target.value })
                  }
                  placeholder="reasons.rejected"
                />
              </label>
              <label className="text-sm">
                Label
                <Input
                  required
                  maxLength={80}
                  value={field.label}
                  onChange={(event) =>
                    updateField(index, { label: event.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Display
                <NativeSelect
                  value={field.kind}
                  onChange={(event) =>
                    updateField(index, {
                      kind: event.target.value as Field["kind"],
                    })
                  }
                >
                  <option value="count">Count</option>
                  <option value="category">Category</option>
                  <option value="reasons">Reason distribution</option>
                </NativeSelect>
              </label>
              <label className="text-sm">
                Unit (optional)
                <Input
                  maxLength={80}
                  value={field.unit}
                  onChange={(event) =>
                    updateField(index, { unit: event.target.value })
                  }
                  placeholder="rows"
                />
              </label>
              <label className="text-sm">
                Aggregate across runs
                <NativeSelect
                  value={field.aggregate ? "yes" : "no"}
                  onChange={(event) =>
                    updateField(index, {
                      aggregate: event.target.value === "yes",
                    })
                  }
                >
                  <option value="no">Presentation only</option>
                  <option value="yes">
                    Allow reported totals/distributions
                  </option>
                </NativeSelect>
              </label>
              {field.kind !== "count" && (
                <label className="text-sm">
                  Allowed categories/reasons (comma-separated, max 20)
                  <Input
                    required={field.aggregate}
                    value={field.values}
                    onChange={(event) =>
                      updateField(index, { values: event.target.value })
                    }
                  />
                </label>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFields((items) => items.filter((_, i) => i !== index))
                }
              >
                Remove field {index + 1}
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={fields.length >= 12}
            onClick={() => setFields((items) => [...items, blankField()])}
          >
            Add result field
          </Button>
          {create.error && (
            <p role="alert" className="text-sm text-destructive">
              Could not save: {create.error.message}
            </p>
          )}
          {validation && (
            <p role="status" className="text-sm">
              {validation}
            </p>
          )}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save new revision"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
