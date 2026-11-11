"use client"
import { CheckCheck } from "lucide-react"
import { CreateProjectForm } from "../../projects/create-project-form"
import type { useOnboarding } from "../use-onboarding"
export function ProjectStep({
  current,
  projects,
  setCreatedSecret,
}: Pick<
  ReturnType<typeof useOnboarding>,
  "current" | "projects" | "setCreatedSecret"
>) {
  return projects.length > 0 ? (
    <div className="flex items-start gap-3 rounded-lg border border-primary/15 bg-primary/5 p-4">
      <CheckCheck
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-primary"
      />
      <div>
        <p className="text-sm font-medium">
          {current?.name ?? "Selecting your project…"}
        </p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Your project is ready. Continue to configure your application.
        </p>
      </div>
    </div>
  ) : (
    <CreateProjectForm onCreated={setCreatedSecret} />
  )
}
