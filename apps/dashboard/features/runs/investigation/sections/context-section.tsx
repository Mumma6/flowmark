"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { JsonData } from "../../../shared/json-data"
import { formatTimestamp } from "../../../shared/format"
import type { InvestigationSectionProps } from "../investigation-types"

export function ContextSection({
  first,
  context,
}: Pick<InvestigationSectionProps, "first" | "context">) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run context</CardTitle>
          <CardDescription>
            Latest shallow merge of initial properties and context amendments.
            Event history stays unchanged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="mb-5 grid gap-4 text-sm sm:grid-cols-2 [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all">
            <div>
              <dt>Started (UTC)</dt>
              <dd>{formatTimestamp(first.timestamp)}</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>{first.environment ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Release</dt>
              <dd>{first.release ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>External run ID</dt>
              <dd>
                <code>{first.externalId}</code>
              </dd>
            </div>
          </dl>
          {context.size > 0 ? (
            <JsonData value={Object.fromEntries(context)} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No properties recorded.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
