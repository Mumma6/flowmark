import type { ReactNode } from "react"
import { publicConfig } from "../platform/config-public"
import { HelpLinks } from "./help-links"

export function RecoveryScreen({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-lg content-center gap-6 px-6 py-16">
      <div className="grid gap-3">
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
      <HelpLinks documentationUrl={publicConfig.documentationUrl} />
    </main>
  )
}
