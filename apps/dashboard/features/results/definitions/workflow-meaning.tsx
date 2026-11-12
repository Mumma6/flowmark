"use client"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Result, Schema } from "effect"
import { ResultDeclarationSchema } from "@flowmarkdev/core"
import { useTRPC } from "../../platform/api-trpc"
import { useProject } from "../../projects/project-context"
import { searchFieldOwnerLabel } from "./metadata-source"
import { definitionFieldDescription } from "./definition-document"

const declarationFields = Schema.decodeUnknownResult(ResultDeclarationSchema)

export function WorkflowMeaning({ workflow }: { workflow: string }) {
  const trpc = useTRPC()
  const { current } = useProject()
  const meaning = useInfiniteQuery(
    trpc.workflow.meaning.infiniteQueryOptions(
      { workflow, limit: 10 },
      {
        enabled: Boolean(current),
        getNextPageParam: (page) => page.nextCursor ?? undefined,
      },
    ),
  )
  const first = meaning.data?.pages[0]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Declared meaning</CardTitle>
        <CardDescription>
          These are the same project-scoped declarations available to authorized
          agents. A source identifies who maintains metadata; it grants no
          access.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 text-sm">
        {meaning.isPending && <p role="status">Loading metadata…</p>}
        {meaning.error && (
          <p role="alert">
            Could not load metadata.{" "}
            <Button variant="outline" onClick={() => void meaning.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {first?.totalRevisions === 0 && (
          <p>
            No result revisions configured. Simple SDK instrumentation still
            works.
          </p>
        )}
        {meaning.data?.pages
          .flatMap((page) => page.revisions)
          .map((revision) => (
            <details
              key={revision.revision}
              className="min-w-0 rounded-md border border-border p-3"
            >
              <summary className="cursor-pointer break-words">
                {revision.revision} ·{" "}
                {revision.source ? `Code: ${revision.source}` : "Studio"}
              </summary>
              <div className="mt-2 grid gap-1">
                {revision.truncated ? (
                  <p>
                    Declaration exceeds the bounded preview. Inspect a narrower
                    revision selection.
                  </p>
                ) : (
                  Result.match(declarationFields(revision.declaration), {
                    onFailure: () => (
                      <p role="alert">This declaration could not be read.</p>
                    ),
                    onSuccess: (declaration) =>
                      declaration.fields.map((field) => (
                        <p
                          key={JSON.stringify(field.path)}
                          className="break-words"
                        >
                          {definitionFieldDescription(field)}
                        </p>
                      )),
                  })
                )}
              </div>
            </details>
          ))}
        {first?.searchFields.map((field) => (
          <p key={field.key} className="break-words">
            {field.key} ·{" "}
            {field.role === "lookup"
              ? "Exact reference"
              : `Category: ${field.values.join(", ")}`}{" "}
            · {searchFieldOwnerLabel(first.searchSources, field.key)}
          </p>
        ))}
        {meaning.hasNextPage && (
          <Button
            variant="outline"
            className="justify-self-start"
            disabled={meaning.isFetchingNextPage}
            onClick={() => void meaning.fetchNextPage()}
          >
            {meaning.isFetchingNextPage ? "Loading…" : "More revisions"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
