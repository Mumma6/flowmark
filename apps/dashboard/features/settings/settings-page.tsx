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
import { ConnectSetupPanel } from "../connect/setup/connect-setup"
import { useProject } from "../projects/project-context"
import { AccountSecurity } from "./account-security"
import { AccountSettings } from "./account-settings"
import { KeySettings } from "./key-settings"
import { ProjectSettings } from "./project-settings"
import { DefinitionImportPanel } from "../results/definitions/definition-import-panel"
import { DataPrivacyPanel } from "./data-privacy/data-privacy-panel"

type SettingsSection =
  | "projects"
  | "keys"
  | "setup"
  | "account"
  | "security"
  | "definitions"
  | "privacy"

const sections: ReadonlyArray<{
  readonly id: SettingsSection
  readonly label: string
}> = [
  { id: "projects", label: "Projects" },
  { id: "keys", label: "API keys" },
  { id: "setup", label: "Setup help" },
  { id: "definitions", label: "Process metadata" },
  { id: "account", label: "Account" },
  { id: "security", label: "Security" },
  { id: "privacy", label: "Data & privacy" },
]

const sectionHelp: Record<SettingsSection, string> = {
  security: "Manage your password and sign out other browser sessions.",
  privacy:
    "Review the exact scope before permanently erasing telemetry or deleting a project.",
  definitions:
    "Review and apply optional result labels and searchable references from your application code. This changes metadata, never application execution.",
  projects:
    "Create or select the project that owns the work you want to observe. Switch projects in the Studio header to inspect their runs.",
  keys: "Create project write keys for ingestion or secret read keys for a server-side read client. Browser ingestion keys never grant reads. Use Connect for delegated agent access.",
  setup:
    "Follow coding-agent or manual SDK instructions to instrument your application, then verify evidence in Runs. For reading evidence with Codex, Cursor, Claude Code or a custom agent, open Connect and scroll to agent access.",
  account:
    "Update the identity and credentials you use to sign in to the dashboard.",
}

function parseSection(value: string | null): SettingsSection {
  if (
    value === "projects" ||
    value === "privacy" ||
    value === "keys" ||
    value === "setup" ||
    value === "definitions" ||
    value === "account" ||
    value === "security"
  ) {
    return value
  }
  return "projects"
}

function SettingsPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { projects, current } = useProject()
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
          className="h-auto w-full flex-wrap justify-start gap-1 border-b border-border pb-2 [&_[data-slot=tabs-trigger]]:after:bg-highlight [&_[data-slot=tabs-trigger]]:min-h-10 sm:[&_[data-slot=tabs-trigger]]:min-h-8 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:text-xs"
        >
          {sections.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          {sectionHelp[section]}
        </p>
        <TabsContent value="projects" className="mt-6">
          <ProjectSettings />
        </TabsContent>
        <TabsContent value="keys" className="mt-6">
          <KeySettings key={current?.id ?? "no-project"} />
        </TabsContent>
        <TabsContent value="setup" className="mt-6">
          <ConnectSetupPanel compact />
        </TabsContent>
        <TabsContent value="account" className="mt-6">
          <AccountSettings
            verificationLinkFailed={
              searchParams.get("emailVerification") === "complete" &&
              searchParams.has("error")
            }
          />
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <AccountSecurity />
        </TabsContent>
        <TabsContent value="definitions" className="mt-6">
          <DefinitionImportPanel />
        </TabsContent>
        <TabsContent value="privacy" className="mt-6">
          <DataPrivacyPanel />
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
