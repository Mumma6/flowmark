"use client"
import { CheckCheck } from "lucide-react"
import {
  Alert,
  AlertDescription,
  NativeSelect,
  NativeSelectOption,
} from "@flowmark/ui"
import { CreateProjectForm } from "../../projects/create-project-form"
import { useProject } from "../../projects/project-context"
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
  const { select } = useProject()
  const projectCreated: typeof setCreatedSecret = (secret, projectId) => {
    setStep(0)
    setCreatedSecret(secret, projectId)
  }
  if (projects.length === 0) {
    return <CreateProjectForm onCreated={projectCreated} />
  }
  return (
    <div className="grid gap-4">
      <label className="grid gap-2 text-sm">
        <span>Project for this setup</span>
        <NativeSelect
          value={current?.id ?? ""}
          onChange={(event) => {
            setStep(0)
            select(event.target.value)
          }}
        >
          <NativeSelectOption value="" disabled>
            Choose a project
          </NativeSelectOption>
          {projects.map((project) => (
            <NativeSelectOption key={project.id} value={project.id}>
              {project.name}
              {project.role === "owner" ? "" : " (read-only)"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
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
              Your project is ready. Continue to configure your application.
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
