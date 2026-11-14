"use client"

import { ProjectOwnerOnly } from "../../project-sharing/project-owner-only"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
} from "@flowmark/ui"
import { useProject } from "../../projects/project-context"
import { ViewLink } from "../../shared/dashboard-components"
import { useDefinitionImport } from "./use-definition-import"
import { WorkflowMeaning } from "./workflow-meaning"
import {
  definitionResultActionLabel,
  definitionFieldDescription,
} from "./definition-document"
import example from "../../../../../examples/booking-definition.json"

function DefinitionImportPanelContent({ workflow }: { workflow?: string }) {
  const { current } = useProject()
  return current ? (
    <ImportForm
      key={`${current.id}:${workflow ?? "any"}`}
      projectId={current.id}
      workflow={workflow}
    />
  ) : (
    <p className="text-sm text-muted-foreground">
      Select a project to review process metadata.
    </p>
  )
}

function ImportForm({
  projectId,
  workflow,
}: {
  projectId: string
  workflow?: string
}) {
  const form = useDefinitionImport(projectId, workflow)
  const review = form.preview.data
  const receipt = form.apply.data
  const visibleWorkflow = receipt?.workflow ?? workflow ?? review?.workflow
  return (
    <div className="grid min-w-0 gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Import process metadata</CardTitle>
          <CardDescription>
            Keep result labels and searchable references beside your application
            code. Review a definition before saving it to this project. Existing
            revisions and search permissions are preserved. Basic
            instrumentation needs no definition file.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4">
          <form
            className="grid min-w-0 gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              form.review()
            }}
          >
            <label className="grid min-w-0 gap-2 text-sm">
              Definition JSON
              <Textarea
                rows={12}
                maxLength={100000}
                value={form.document}
                disabled={form.busy}
                onChange={(event) => form.update(event.target.value)}
                placeholder='{"version":1,"source":"my-app","workflow":"booking.create","searchFields":[{"key":"bookingRef","role":"lookup"}]}'
                className="min-w-0 font-mono text-xs"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={form.busy || form.document.trim().length === 0}
              >
                {form.preview.isPending ? "Reviewing…" : "Preview changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={form.busy}
                onClick={() =>
                  form.update(
                    JSON.stringify(
                      { ...example, workflow: workflow ?? example.workflow },
                      null,
                      2,
                    ),
                  )
                }
              >
                Load booking example
              </Button>
            </div>
          </form>
          {form.validation && (
            <p role="alert" className="text-sm">
              {form.validation}
            </p>
          )}
          {form.preview.error && (
            <p role="alert" className="text-sm">
              Could not preview: {form.preview.error.message}. Your document is
              preserved; preview again to retry.
            </p>
          )}
          {review && (
            <section
              aria-label="Import review"
              className="grid gap-3 rounded-lg border border-border p-4 text-sm"
            >
              <p className="break-words font-medium">
                {review.workflow} · Source: {review.source}
              </p>
              <p role="status">
                {review.status === "Conflict"
                  ? "Conflicts must be resolved before applying."
                  : review.status === "Unchanged"
                    ? "This metadata is already configured. Its existing ownership is preserved."
                    : "Review these changes before applying them."}
              </p>
              <p>
                Result revision{" "}
                {review.result.requested?.revision ?? "not requested"}:{" "}
                {definitionResultActionLabel(review.result.action)}.
              </p>
              {review.result.requested && (
                <ul className="grid gap-1 pl-4">
                  {review.result.requested.fields.map((field) => (
                    <li
                      key={JSON.stringify(field.path)}
                      className="break-words"
                    >
                      {definitionFieldDescription(field)}
                    </li>
                  ))}
                </ul>
              )}
              {review.result.action === "Conflict" && (
                <>
                  <p role="alert">
                    This revision already has different meaning. Choose a new
                    revision; old runs will keep their original labels.
                  </p>
                  {review.result.current && (
                    <details>
                      <summary className="cursor-pointer">
                        Existing permanent meaning
                      </summary>
                      <ul className="mt-2 grid gap-1 pl-4">
                        {review.result.current.fields.map((field) => (
                          <li
                            key={JSON.stringify(field.path)}
                            className="break-words"
                          >
                            {definitionFieldDescription(field)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
              <p>
                {review.searchFields.additions.length} search fields to add;{" "}
                {review.searchFields.retained.length} existing fields retained.
              </p>
              {review.searchFields.additions.map((field) => (
                <p key={field.key} className="break-all">
                  Add {field.key} ·{" "}
                  {field.role === "lookup"
                    ? "Exact reference"
                    : `Category: ${field.values.join(", ")}`}
                </p>
              ))}
              {review.searchFields.conflicts.map((field) => (
                <p role="alert" key={field.key}>
                  Search permission conflict: {field.key}. Keep its current role
                  and values.
                </p>
              ))}
              {review.searchFields.capacityExceeded && (
                <p role="alert">
                  The combined configuration exceeds eight search fields.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                A new result revision only labels runs that explicitly report
                it. Existing runs are never assigned a new revision.
              </p>
              <Button
                className="justify-self-start"
                disabled={
                  form.busy ||
                  review.status !== "Reviewable" ||
                  Boolean(receipt)
                }
                onClick={form.commit}
              >
                {form.apply.isPending ? "Applying…" : "Apply reviewed metadata"}
              </Button>
            </section>
          )}
          {form.apply.error && (
            <p role="alert" className="text-sm">
              Could not confirm apply: {form.apply.error.message}. Imports are
              atomic. Retry the same reviewed import after a lost reply, or
              preview again if the configuration changed.
            </p>
          )}
          {receipt && (
            <div role="status" className="grid gap-2 text-sm">
              <p>
                {receipt.status === "AlreadyApplied"
                  ? "This reviewed import was already applied. Preview again to inspect the current configuration."
                  : "Process metadata saved."}
              </p>
              <p className="break-words text-xs text-muted-foreground">
                Receipt {receipt.receiptId} · {receipt.appliedAt}
              </p>
              <ViewLink
                href={`/runs?workflow=${encodeURIComponent(receipt.workflow)}`}
              >
                Inspect {receipt.workflow}
              </ViewLink>
            </div>
          )}
        </CardContent>
      </Card>
      {visibleWorkflow && (
        <WorkflowMeaning key={visibleWorkflow} workflow={visibleWorkflow} />
      )}
    </div>
  )
}

export function DefinitionImportPanel({ workflow }: { workflow?: string }) {
  return (
    <ProjectOwnerOnly>
      <DefinitionImportPanelContent workflow={workflow} />
    </ProjectOwnerOnly>
  )
}
