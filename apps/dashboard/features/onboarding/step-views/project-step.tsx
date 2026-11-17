"use client"
import { CheckCheck } from "lucide-react"
import {
  Alert,
  AlertDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flowmark/ui"
import { CreateProjectForm } from "../../projects/create-project-form"
import { projectListState } from "../../projects/project-list-state"
import { useProject } from "../../projects/project-context"
import { DataState } from "../../shared/dashboard-components"
import type { useOnboarding } from "../use-onboarding"
export function ProjectStep({
  current,
  projects,
  setCreatedSecret,
  setStep,
}: Pick<
  ReturnType<typeof useOnboarding>,
  "current" | "projects" | "setCreatedSecret" | "setStep"
>) {
  const { select, pending, error, retry } = useProject()
  const projectCreated: typeof setCreatedSecret = (secret, projectId) => {
    setStep(0)
    setCreatedSecret(secret, projectId)
  }
  const list = projectListState({
    pending,
    failed: error !== null,
    count: projects.length,
  })
  if (list === "unavailable" || list === "pending") {
    return (
      <DataState
        pending={list === "pending"}
        error={list === "unavailable" ? error : null}
        retry={retry}
      />
    )
  }
  if (list === "empty") {
    return <CreateProjectForm onCreated={projectCreated} />
  }
  return (
    <div className="grid gap-4">
      <label className="grid gap-2 text-sm">
        <span>Project for this setup</span>
        <Select
          items={Object.fromEntries(
            projects.map((project) => [
              project.id,
              `${project.name}${project.role === "owner" ? "" : " (read-only)"}`,
            ]),
          )}
          value={current?.id ?? null}
          onValueChange={(next) => {
            setStep(0)
            select(next)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
                {project.role === "owner" ? "" : " (read-only)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {current?.role === "owner" ? (
        <div className="flex items-start gap-3 rounded-lg border border-primary/15 bg-primary/5 p-4">
          <CheckCheck
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">
              {current?.name ?? "Selecting your project…"}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Your project is ready. Save its ingestion key, then get
              AI-assisted or manual SDK setup instructions.
            </p>
          </div>
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            This project's owner manages ingestion keys. Choose a project you
            own, or create your own project below. Read access does not require
            SDK setup.
          </AlertDescription>
        </Alert>
      )}
      <details>
        <summary className="cursor-pointer text-sm text-primary underline underline-offset-4">
          Create another project
        </summary>
        <div className="mt-4">
          <CreateProjectForm onCreated={projectCreated} />
        </div>
      </details>
    </div>
  )
}
