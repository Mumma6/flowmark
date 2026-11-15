"use client"

import { Button, Input, RunSnapshot, Textarea } from "@flowmark/ui"
import { Result } from "effect"
import Link from "next/link"
import { useRef, useState } from "react"
import { decodeSuppliedSnapshot, exampleSnapshot } from "./supplied-snapshot"

export default function EvidencePage() {
  const [input, setInput] = useState(JSON.stringify(exampleSnapshot, null, 2))
  const [applied, setApplied] = useState(input)
  const [light, setLight] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const fileVersion = useRef(0)
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
          Local only. Open a JSON snapshot exported by the read consumer, or
          paste one copied from Studio’s Timeline → Table → Portable evidence
          snapshot. This host makes no evidence requests and holds no
          credentials. Supplied data is not proof of current access, freshness
          or correctness. Nothing is saved or sent by this page.
        </p>
        <div className="grid gap-2">
          <label htmlFor="snapshot-file" className="text-sm font-medium">
            Open snapshot file (maximum 64 KiB)
          </label>
          <Input
            id="snapshot-file"
            type="file"
            accept=".json,application/json"
            aria-describedby="snapshot-file-status"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) {
                return
              }
              const version = ++fileVersion.current
              setApplied("")
              setInput("")
              setFileError(null)
              setReading(false)
              if (file.size > 65536) {
                setFileError(
                  "File exceeds 64 KiB. Export a smaller evidence page.",
                )
                return
              }
              setReading(true)
              try {
                const value = await file.text()
                if (fileVersion.current !== version) {
                  return
                }
                setInput(value)
                setApplied(value)
              } catch {
                if (fileVersion.current === version) {
                  setFileError(
                    "Could not read the file. Select it again or paste its JSON below.",
                  )
                }
              } finally {
                if (fileVersion.current === version) {
                  setReading(false)
                }
              }
            }}
          />
          <p
            id="snapshot-file-status"
            role={fileError ? "alert" : "status"}
            className="text-sm text-muted-foreground"
          >
            {fileError ??
              (reading
                ? "Reading local file…"
                : "File contents stay in this page; nothing is uploaded or saved.")}
          </p>
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            ++fileVersion.current
            setReading(false)
            setFileError(null)
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
            onChange={(event) => {
              ++fileVersion.current
              setReading(false)
              setFileError(null)
              setInput(event.target.value)
            }}
            className="min-h-40 font-mono text-xs"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Render supplied evidence</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                ++fileVersion.current
                setReading(false)
                setFileError(null)
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
        {!reading &&
          !fileError &&
          Result.match(decoded, {
            onFailure: () => (
              <p role="alert" className="text-sm text-destructive">
                Invalid snapshot. Supply the complete Studio snapshot, with
                coverage notes, at most 8 unique milestones and 4 metrics.
                Unknown fields and oversized values are rejected. No evidence is
                rendered.
              </p>
            ),
            onSuccess: (snapshot) => (
              <RunSnapshot key={applied} {...snapshot} />
            ),
          })}
      </div>
    </main>
  )
}
