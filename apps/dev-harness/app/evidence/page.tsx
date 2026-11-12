"use client"

import { Button, RunSnapshot, Textarea } from "@flowmark/ui"
import { Result } from "effect"
import Link from "next/link"
import { useState } from "react"
import { decodeSuppliedSnapshot, exampleSnapshot } from "./supplied-snapshot"

export default function EvidencePage() {
  const [input, setInput] = useState(JSON.stringify(exampleSnapshot, null, 2))
  const [applied, setApplied] = useState(input)
  const [light, setLight] = useState(false)
  const decoded = decodeSuppliedSnapshot(applied)
  return (
    <main
      data-theme={light ? "light" : "dark"}
      className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8"
    >
      <div className="mx-auto grid max-w-5xl gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm underline">
            Back to local harness
          </Link>
          <Button variant="outline" onClick={() => setLight(!light)}>
            {light ? "Use dark theme" : "Use light theme"}
          </Button>
        </div>
        <h1 className="text-2xl font-semibold">Supplied evidence host</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Local only. Paste the snapshot copied from Studio’s Timeline → Table →
          Portable evidence snapshot. This host makes no evidence requests and
          holds no credentials. Supplied data is not proof of current access,
          freshness or correctness. Nothing is saved or sent by this page.
        </p>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            setApplied(input)
          }}
        >
          <label className="text-sm font-medium" htmlFor="snapshot-json">
            Supplied snapshot JSON (maximum 65,536 characters)
          </label>
          <Textarea
            id="snapshot-json"
            value={input}
            maxLength={65536}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-40 font-mono text-xs"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Render supplied evidence</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const value = JSON.stringify(exampleSnapshot, null, 2)
                setInput(value)
                setApplied(value)
              }}
            >
              Load synthetic example
            </Button>
          </div>
          {input !== applied && (
            <p role="status" className="text-sm text-muted-foreground">
              Changes have not been applied to the view below.
            </p>
          )}
        </form>
        {Result.match(decoded, {
          onFailure: () => (
            <p role="alert" className="text-sm text-destructive">
              Invalid snapshot. Supply the complete Studio snapshot, with
              coverage notes, at most 8 unique milestones and 4 metrics. Unknown
              fields and oversized values are rejected. No evidence is rendered.
            </p>
          ),
          onSuccess: (snapshot) => <RunSnapshot key={applied} {...snapshot} />,
        })}
      </div>
    </main>
  )
}
