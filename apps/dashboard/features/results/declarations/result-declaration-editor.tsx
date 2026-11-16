"use client"

import { ProjectOwnerOnly } from "../../project-sharing/project-owner-only"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flowmark/ui"
import { useProject } from "../../projects/project-context"

const displayItems = {
  count: "Count",
  category: "Category",
  reasons: "Reason distribution",
}

const aggregateItems = {
  no: "Presentation only",
  yes: "Allow reported totals/distributions",
}
import { useResultDeclarationForm } from "./use-result-declaration-form"

function ResultDeclarationEditorContent({ workflow }: { workflow: string }) {
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
  const {
    revision,
    setRevision,
    fields,
    addField,
    removeField,
    submit,
    validation,

    declarations,
    create,
    updateField,
  } = useResultDeclarationForm({ workflow, projectId })
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
            submit()
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
                <Select
                  items={displayItems}
                  value={field.kind}
                  onValueChange={(next) =>
                    updateField(index, {
                      kind:
                        next === "category" || next === "reasons"
                          ? next
                          : "count",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="reasons">Reason distribution</SelectItem>
                  </SelectContent>
                </Select>
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
                <Select
                  items={aggregateItems}
                  value={field.aggregate ? "yes" : "no"}
                  onValueChange={(next) =>
                    updateField(index, {
                      aggregate: next === "yes",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Presentation only</SelectItem>
                    <SelectItem value="yes">
                      Allow reported totals/distributions
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                onClick={() => removeField(index)}
              >
                Remove field {index + 1}
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={fields.length >= 12}
            onClick={() => addField()}
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

export function ResultDeclarationEditor({ workflow }: { workflow: string }) {
  return (
    <ProjectOwnerOnly>
      <ResultDeclarationEditorContent workflow={workflow} />
    </ProjectOwnerOnly>
  )
}
