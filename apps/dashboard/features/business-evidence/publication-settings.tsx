"use client"
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
} from "@flowmark/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Array } from "effect"
import Link from "next/link"
import { useState } from "react"
import { useTRPCClient } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import { authClient } from "../auth/auth-client"
import { ProjectOwnerOnly } from "../project-sharing/project-owner-only"
import type { BusinessPublication } from "@flowmarkdev/core"
type Configuration = Awaited<
  ReturnType<
    ReturnType<
      typeof useTRPCClient
    >["businessEvidence"]["configuration"]["query"]
  >
>
function PublicationForm({
  projectId,
  configuration,
  refresh,
}: {
  readonly projectId: string
  readonly configuration: Configuration
  readonly refresh: () => Promise<unknown>
}) {
  const client = useTRPCClient(),
    cache = useQueryClient()
  const [publication, setPublication] = useState<BusinessPublication>(
    configuration.publication,
  )
  const [confirmed, setConfirmed] = useState(false)
  const update = useMutation({
    mutationFn: () =>
      client.businessEvidence.replace.mutate({
        projectId,
        expectedRevision: configuration.revision,
        publication,
      }),
    onSuccess: async () => {
      setConfirmed(false)
      await cache.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === "business-evidence" ||
          q.queryKey[0] === "business-capabilities",
      })
      await refresh()
    },
  })
  const fieldIds = Array.flatMap(publication.results, (e) =>
    Array.map(e.paths, (path) =>
      JSON.stringify([e.workflow, e.revision, path]),
    ),
  )
  const referenceIds = Array.flatMap(publication.references, (e) =>
    Array.map(e.keys, (key) => JSON.stringify([e.workflow, key])),
  )
  const toggleField = (
    workflow: string,
    revision: string,
    path: readonly string[],
    checked: boolean,
  ) =>
    setPublication((current) => {
      const entries = Array.filter(
        current.results,
        (e) => !(e.workflow === workflow && e.revision === revision),
      )
      const existing = current.results.find(
        (e) => e.workflow === workflow && e.revision === revision,
      )
      const paths = checked
        ? [...(existing?.paths ?? []), path]
        : Array.filter(
            existing?.paths ?? [],
            (p) => JSON.stringify(p) !== JSON.stringify(path),
          )
      return {
        ...current,
        results: paths.length
          ? [...entries, { workflow, revision, paths }]
          : entries,
      }
    })
  const toggleReference = (workflow: string, key: string, checked: boolean) =>
    setPublication((current) => {
      const entries = Array.filter(
          current.references,
          (e) => e.workflow !== workflow,
        ),
        existing = current.references.find((e) => e.workflow === workflow)
      const keys = checked
        ? [...(existing?.keys ?? []), key]
        : Array.filter(existing?.keys ?? [], (k) => k !== key)
      return {
        ...current,
        references: keys.length ? [...entries, { workflow, keys }] : entries,
      }
    })
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (confirmed && !update.isPending) {
          update.mutate()
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        Publication {configuration.revision}. Business readers already see
        project-wide workflow activity, status, reported outcome codes and
        timing. Select the additional result/reference values they may see. This
        is not customer-scoped access.
      </p>
      <Button asChild variant="outline" className="justify-self-start">
        <Link
          href={
            "/?businessSelection=" +
            encodeURIComponent(JSON.stringify({ kind: "overview" }))
          }
        >
          Preview business evidence
        </Link>
      </Button>
      <fieldset className="grid gap-3" disabled={update.isPending}>
        <legend className="mb-3 font-medium">
          Result fields · exact immutable revisions
        </legend>
        {configuration.choices.declarations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No result declarations are available. Add process metadata first.
          </p>
        ) : (
          configuration.choices.declarations.map((entry) => (
            <section
              key={JSON.stringify([entry.workflow, entry.declaration.revision])}
              className="grid gap-3 rounded-lg border border-border p-3"
            >
              <h4 className="break-all text-sm font-medium">
                {entry.workflow} · {entry.declaration.revision}
              </h4>
              {entry.declaration.fields.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No count or closed-vocabulary fields can be published.
                </p>
              ) : (
                entry.declaration.fields.map((field) => (
                  <label
                    key={JSON.stringify(field.path)}
                    className="flex items-start gap-3 text-sm"
                  >
                    <Checkbox
                      checked={Array.contains(
                        fieldIds,
                        JSON.stringify([
                          entry.workflow,
                          entry.declaration.revision,
                          field.path,
                        ]),
                      )}
                      onCheckedChange={(checked) =>
                        toggleField(
                          entry.workflow,
                          entry.declaration.revision,
                          field.path,
                          checked === true,
                        )
                      }
                    />
                    <span className="break-all">
                      {field.label} · {field.path.join(" → ")}
                      {field.values
                        ? ` · exposed vocabulary: ${field.values.join(", ")}`
                        : ""}
                    </span>
                  </label>
                ))
              )}
            </section>
          ))
        )}
      </fieldset>
      <fieldset className="grid gap-3" disabled={update.isPending}>
        <legend className="mb-3 font-medium">
          Reference values · all values of selected keys
        </legend>
        {configuration.choices.references.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No searchable reference keys are declared.
          </p>
        ) : (
          configuration.choices.references.map((entry) => (
            <section
              key={entry.workflow}
              className="grid gap-3 rounded-lg border border-border p-3"
            >
              <h4 className="break-all text-sm font-medium">
                {entry.workflow}
              </h4>
              {entry.fields.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center gap-3 text-sm"
                >
                  <Checkbox
                    checked={Array.contains(
                      referenceIds,
                      JSON.stringify([entry.workflow, field.key]),
                    )}
                    onCheckedChange={(checked) =>
                      toggleReference(
                        entry.workflow,
                        field.key,
                        checked === true,
                      )
                    }
                  />
                  <span>
                    {field.key} · {field.role}
                  </span>
                </label>
              ))}
            </section>
          ))
        )}
      </fieldset>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(checked) => setConfirmed(checked === true)}
          disabled={update.isPending}
        />
        <span>
          I intend to disclose these labels, vocabularies and values to all
          current business readers. Removing publication prevents future reads,
          but cannot erase downloaded copies.
        </span>
      </label>
      {update.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {update.error.message}{" "}
            <Button variant="outline" onClick={() => void refresh()}>
              Reload latest publication
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {update.isSuccess ? (
        <p role="status" className="text-sm">
          Publication saved. Subsequent reads use the new policy.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!confirmed || update.isPending}>
          {update.isPending ? "Saving publication…" : "Save publication"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={update.isPending}
          onClick={() => {
            setPublication({ results: [], references: [] })
            setConfirmed(false)
          }}
        >
          Clear all published values
        </Button>
      </div>
    </form>
  )
}
function PublicationControls() {
  const { current } = useProject(),
    identity = authClient.useSession(),
    client = useTRPCClient()
  const config = useQuery({
    queryKey: [
      "business-publication",
      identity.data?.user.id,
      identity.data?.session.id,
      current?.id,
    ],
    queryFn: ({ signal }) =>
      client.businessEvidence.configuration.query(
        { projectId: current!.id },
        { signal },
      ),
    enabled: current?.role === "owner" && Boolean(identity.data),
    retry: false,
    gcTime: 0,
  })
  if (!current) {
    return <p>Select a project.</p>
  }
  if (config.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {config.error.message}{" "}
          <Button onClick={() => void config.refetch()}>
            Retry publication
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (!config.data) {
    return <p role="status">Loading publication…</p>
  }
  return (
    <PublicationForm
      key={`${current.id}:${config.data.revision}`}
      projectId={current.id}
      configuration={config.data}
      refresh={() => config.refetch()}
    />
  )
}
export function PublicationSettings() {
  return (
    <ProjectOwnerOnly>
      <Card>
        <CardHeader>
          <CardTitle>Business evidence publication</CardTitle>
        </CardHeader>
        <CardContent>
          <PublicationControls />
        </CardContent>
      </Card>
    </ProjectOwnerOnly>
  )
}
