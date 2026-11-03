"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flowmark/ui"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { PageHeading } from "../shared/dashboard-components"
import { AgentPromptCard } from "../onboarding/getting-started"
import { useProject } from "../projects/project-context"
import { AccountSettings } from "./account-settings"
import { KeySettings } from "./key-settings"
import { ProjectSettings } from "./project-settings"

type SettingsSection = "projects" | "keys" | "setup" | "account"

const sections: ReadonlyArray<{
  readonly id: SettingsSection
  readonly label: string
}> = [
  { id: "projects", label: "Projects" },
  { id: "keys", label: "Ingestion keys" },
  { id: "setup", label: "Setup help" },
  { id: "account", label: "Account" },
]

function parseSection(value: string | null): SettingsSection {
  if (
    value === "projects" ||
    value === "keys" ||
    value === "setup" ||
    value === "account"
  ) {
    return value
  }
  return "projects"
}

function SettingsPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { projects } = useProject()
  const section = parseSection(searchParams.get("section"))
  const setSection = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("section", next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title="Settings"
        description="Manage your projects, application access and account."
      />
      {projects.length === 0 ? (
        <Alert>
          <AlertTitle>No project yet</AlertTitle>
          <AlertDescription>
            Your account is ready. Create a project under Projects to get a
            write key and start recording runs.
          </AlertDescription>
        </Alert>
      ) : null}
      <Tabs value={section} onValueChange={setSection}>
        <TabsList
          variant="line"
          aria-label="Settings sections"
          className="h-auto w-full flex-wrap justify-start gap-1 border-b border-border pb-2 [&_[data-slot=tabs-trigger]]:min-h-11 [&_[data-slot=tabs-trigger]]:flex-none"
        >
          {sections.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="projects" className="mt-6">
          <ProjectSettings />
        </TabsContent>
        <TabsContent value="keys" className="mt-6">
          <KeySettings />
        </TabsContent>
        <TabsContent value="setup" className="mt-6">
          <AgentPromptCard />
        </TabsContent>
        <TabsContent value="account" className="mt-6">
          <AccountSettings
            verificationLinkFailed={
              searchParams.get("emailVerification") === "complete" &&
              searchParams.has("error")
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Loading settings…
        </p>
      }
    >
      <SettingsPageInner />
    </Suspense>
  )
}
