"use client"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
} from "@flowmark/ui"
import { Array } from "effect"
import { useState } from "react"
import type { BusinessMeaning, BusinessEvidenceQuery } from "@flowmarkdev/core"
type Props = {
  readonly meaning: BusinessMeaning
  readonly choose: (query: BusinessEvidenceQuery) => void
}
export function BusinessJourneyForm({ meaning, choose }: Props) {
  const choices = Array.flatMap(meaning.references, (entry) =>
    Array.map(entry.keys, (key) => ({ workflow: entry.workflow, key })),
  )
  const [anchor, setAnchor] = useState(
    choices[0] ? JSON.stringify(choices[0]) : "",
  )
  const [value, setValue] = useState("")
  const [selected, setSelected] = useState<readonly string[]>([])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Follow a published business reference</CardTitle>
      </CardHeader>
      <CardContent>
        {choices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The owner has not published any reference keys. Other properties
            remain withheld.
          </p>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const source = choices.find((c) => JSON.stringify(c) === anchor)
              if (!source) {
                return
              }
              const namespaces = [
                source,
                ...Array.filter(
                  choices,
                  (c) =>
                    JSON.stringify(c) !== anchor &&
                    Array.contains(selected, JSON.stringify(c)),
                ),
              ]
              choose({
                kind: "journey",
                query: { ...source, value, namespaces },
              })
            }}
          >
            <label className="grid gap-2 text-sm">
              Anchor workflow and reference key
              <select
                className="h-10 rounded-md border border-input bg-background px-3"
                value={anchor}
                onChange={(e) => setAnchor(e.target.value)}
              >
                {choices.map((c) => (
                  <option key={JSON.stringify(c)} value={JSON.stringify(c)}>
                    {c.workflow} · {c.key}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              Reference value
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                maxLength={256}
              />
            </label>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">
                Include other qualified workflow references (up to seven)
              </legend>
              {choices
                .filter((c) => JSON.stringify(c) !== anchor)
                .map((c) => {
                  const id = JSON.stringify(c)
                  return (
                    <label className="flex items-center gap-3 text-sm" key={id}>
                      <Checkbox
                        checked={Array.contains(selected, id)}
                        disabled={
                          !Array.contains(selected, id) && selected.length >= 7
                        }
                        onCheckedChange={(checked) =>
                          setSelected((current) =>
                            checked === true
                              ? [...current, id]
                              : Array.filter(current, (item) => item !== id),
                          )
                        }
                      />
                      <span className="break-all">
                        {c.workflow} · {c.key}
                      </span>
                    </label>
                  )
                })}
            </fieldset>
            <p className="text-xs text-muted-foreground">
              References are qualified by workflow and key. Equal values alone
              do not prove a causal link or a complete funnel.
            </p>
            <Button type="submit" className="justify-self-start">
              Follow reported journey
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
export function BusinessInsightForm({ meaning, choose }: Props) {
  const fields = Array.flatMap(meaning.results, (entry) =>
    Array.map(
      Array.filter(entry.fields, (field) => field.aggregate),
      (field) => ({
        workflow: entry.workflow,
        revision: entry.revision,
        field,
      }),
    ),
  )
  const [selection, setSelection] = useState(
    fields[0]
      ? JSON.stringify([
          fields[0].workflow,
          fields[0].revision,
          fields[0].field.path,
        ])
      : "",
  )
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const [start, setStart] = useState(weekAgo),
    [end, setEnd] = useState(today)
  const [error, setError] = useState<string | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare a published business result</CardTitle>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The owner has not published result fields. Workflow activity remains
            available; arbitrary result payloads are withheld.
          </p>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const field = fields.find(
                (f) =>
                  JSON.stringify([f.workflow, f.revision, f.field.path]) ===
                  selection,
              )
              if (!field) {
                return
              }
              const after = Date.parse(start + "T00:00:00.000Z"),
                before = Date.parse(end + "T00:00:00.000Z"),
                width = before - after
              if (
                !Number.isFinite(width) ||
                width <= 0 ||
                width > 31 * 86400000
              ) {
                setError("Choose a nonempty UTC window of at most 31 days.")
                return
              }
              setError(null)
              choose({
                kind: "insights",
                query: {
                  workflow: field.workflow,
                  revision: field.revision,
                  path: field.field.path,
                  currentStartedAfter: new Date(after).toISOString(),
                  currentStartedBefore: new Date(before).toISOString(),
                  previousStartedAfter: new Date(after - width).toISOString(),
                  previousStartedBefore: new Date(after).toISOString(),
                },
              })
            }}
          >
            <label className="grid gap-2 text-sm">
              Published result field
              <select
                className="h-10 rounded-md border border-input bg-background px-3"
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
              >
                {fields.map((f) => (
                  <option
                    key={JSON.stringify([f.workflow, f.revision, f.field.path])}
                    value={JSON.stringify([
                      f.workflow,
                      f.revision,
                      f.field.path,
                    ])}
                  >
                    {f.workflow} · {f.field.label} · {f.revision}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                From (UTC, inclusive)
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm">
                Until (UTC, exclusive)
                <Input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Compare with the immediately preceding window of equal length.
              Counts are application reports, with missing and incompatible
              evidence shown separately.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="justify-self-start">
              Compare reported outcomes
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
