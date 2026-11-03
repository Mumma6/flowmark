"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
} from "@flowmark/ui"
import { type FormEvent } from "react"
import { CopyButton } from "../shared/dashboard-components"
import type { CreatedSecret } from "./types"
import { useCreateProject } from "./use-create-project"

export function SecretAlert({
  secret,
  label,
  detail,
}: {
  secret: CreatedSecret
  label: string
  detail?: string
}) {
  return (
    <Alert>
      <AlertTitle>Copy this key now</AlertTitle>
      <AlertDescription className="grid gap-3">
        <p>
          {label} <code>{secret.prefix}…</code>. Flowmark will not show the full
          secret again.
        </p>
        {detail ? <p>{detail}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all text-xs">{secret.secret}</code>
          <CopyButton value={secret.secret} />
        </div>
      </AlertDescription>
    </Alert>
  )
}

export function CreateProjectForm({
  onCreated,
}: {
  onCreated?: (secret: CreatedSecret) => void
}) {
  const { projects, newName, setNewName, secret, create } =
    useCreateProject(onCreated)
  return (
    <div className="grid gap-4">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          create.mutate({ name: newName })
        }}
      >
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Project name</span>
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Production app"
            required
            minLength={1}
            maxLength={80}
          />
        </label>
        <Button type="submit" disabled={create.isPending || !newName.trim()}>
          {projects.length === 0 ? "Create first project" : "Create project"}
        </Button>
      </form>
      <p className="text-xs leading-6 text-muted-foreground">
        Creating a project also issues the first server write key. Put that key
        in your app environment — not in the browser.
      </p>
      {secret ? (
        <SecretAlert secret={secret} label="The new project write key is" />
      ) : null}
      {create.error ? (
        <Alert variant="destructive">
          <AlertDescription>{create.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
