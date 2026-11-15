"use client"

import { Alert, AlertDescription, Button, Input, Textarea } from "@flowmark/ui"
import { useState } from "react"
import { CopyButton } from "../shared/dashboard-components"
import { supportDetailsPreview } from "./support-details"

export function SupportDetailsForm() {
  const [code, setCode] = useState("")
  const [context, setContext] = useState("")
  const [preview, setPreview] = useState<ReturnType<
    typeof supportDetailsPreview
  > | null>(null)
  return (
    <details className="min-w-0 text-sm">
      <summary className="cursor-pointer text-primary underline underline-offset-4">
        Prepare optional support details
      </summary>
      <form
        className="mt-4 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          setPreview(supportDetailsPreview({ code, context }))
        }}
      >
        <p className="text-xs leading-6 text-muted-foreground">
          Nothing is collected or sent automatically. Enter only information you
          want to share. Leave out passwords, keys, email links, personal data
          and private telemetry. Review the preview before copying it into your
          chosen report.
        </p>
        <label className="grid gap-2">
          Error code (optional)
          <Input
            value={code}
            maxLength={64}
            pattern="[A-Z0-9_-]*"
            onChange={(event) => {
              setCode(event.target.value)
              setPreview(null)
            }}
          />
        </label>
        <label className="grid gap-2">
          Your context (optional)
          <Textarea
            value={context}
            maxLength={1000}
            onChange={(event) => {
              setContext(event.target.value)
              setPreview(null)
            }}
          />
        </label>
        <Button type="submit" variant="outline" className="w-fit">
          Review details
        </Button>
        {preview &&
          ("error" in preview ? (
            <Alert variant="destructive">
              <AlertDescription>{preview.error}</AlertDescription>
            </Alert>
          ) : (
            <div className="grid min-w-0 gap-3" aria-live="polite">
              <pre className="whitespace-pre-wrap break-words rounded-lg border border-border p-3 text-xs">
                {preview.text}
              </pre>
              <div>
                <CopyButton
                  value={preview.text}
                  label="Copy reviewed details"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Copying does not send a report.
              </p>
            </div>
          ))}
      </form>
    </details>
  )
}
