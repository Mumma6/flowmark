"use client"

import { useId, useState } from "react"
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

export function WorkflowSearchFields({ workflow }: { workflow: string }) {
  const { current } = useProject()
  const trpc = useTRPC()
  const roleId = useId()
  const cache = useQueryClient()
  const [key, setKey] = useState("")
  const [role, setRole] = useState<"lookup" | "dimension">("lookup")
  const [values, setValues] = useState("")
  const fields = useQuery(
    trpc.resultDeclarations.searchFields.queryOptions(
      { projectId: current?.id ?? "", workflow },
      { enabled: Boolean(current) },
    ),
  )
  const save = useMutation(
    trpc.resultDeclarations.setSearchFields.mutationOptions({
      onSuccess: () => {
        setKey("")
        setValues("")
        void cache.invalidateQueries({
          queryKey: trpc.resultDeclarations.searchFields.queryKey(),
        })
        void cache.invalidateQueries({ queryKey: trpc.run.list.queryKey() })
      },
    }),
  )
  const blocked =
    !current || fields.isPending || Boolean(fields.error) || save.isPending
  return (
    <Card>
      <CardHeader>
        <CardTitle>Business reference search</CardTitle>
        <CardDescription>
          Enable reviewed top-level string properties for exact search.
          References identify executions; categories have an explicit bounded
          vocabulary. Enabling a key makes existing stored values searchable.
          Avoid secrets and personal data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.isPending && <p role="status">Loading search fields…</p>}
        {fields.error && (
          <p role="alert">
            Could not load search fields.{" "}
            <Button variant="outline" onClick={() => void fields.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {fields.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No business fields enabled.
          </p>
        )}
        <ul className="space-y-3">
          {fields.data?.map((field) => (
            <li
              key={field.key}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="break-all text-sm">
                <strong>{field.key}</strong> ·{" "}
                {field.role === "lookup"
                  ? "Reference"
                  : `Category: ${field.values.join(", ")}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={blocked}
                onClick={() =>
                  current &&
                  save.mutate({
                    projectId: current.id,
                    workflow,
                    fields: fields.data.filter(
                      (item) => item.key !== field.key,
                    ),
                  })
                }
              >
                Disable {field.key}
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (blocked || !current) {
              return
            }
            const field =
              role === "lookup"
                ? { key, role }
                : {
                    key,
                    role,
                    values: values
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  }
            save.mutate({
              projectId: current.id,
              workflow,
              fields: [
                ...(fields.data ?? []).filter((item) => item.key !== key),
                field,
              ],
            })
          }}
        >
          <label className="grid gap-2 text-sm">
            Property key
            <Input
              required
              pattern="[a-zA-Z][a-zA-Z0-9_]{0,63}"
              maxLength={64}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="batchId"
            />
          </label>
          <div className="grid gap-2 text-sm">
            <label htmlFor={roleId}>Search role</label>
            <NativeSelect
              id={roleId}
              value={role}
              onChange={(event) =>
                setRole(
                  event.target.value === "dimension" ? "dimension" : "lookup",
                )
              }
            >
              <option value="lookup">Reference (exact match)</option>
              <option value="dimension">Category (allowed values)</option>
            </NativeSelect>
          </div>
          {role === "dimension" && (
            <label className="grid gap-2 text-sm">
              Allowed values, comma separated
              <Input
                required
                value={values}
                maxLength={5139}
                onChange={(event) => setValues(event.target.value)}
                placeholder="crm-a, crm-b"
              />
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Up to 8 keys and 20 values per category; values up to 256
            characters. Saving an existing key updates its search permission.
          </p>
          {save.error && (
            <p role="alert">
              Could not save search fields: {save.error.message}
            </p>
          )}
          {save.isSuccess && <p role="status">Search fields saved.</p>}
          <Button type="submit" disabled={blocked}>
            {save.isPending ? "Saving…" : "Enable or update field"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
