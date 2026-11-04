"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flowmark/ui"
import { Array as Arr, Option } from "effect"
import { usePathname, useSearchParams } from "next/navigation"
import { useSyncExternalStore, type ReactNode } from "react"

type PageSection = {
  readonly value: string
  readonly label: string
  readonly description: string
  readonly content: ReactNode
  readonly keepMounted?: boolean
}

const subscribeToHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify)
  window.addEventListener("popstate", notify)
  return () => {
    window.removeEventListener("hashchange", notify)
    window.removeEventListener("popstate", notify)
  }
}

/** Page navigation preserves the current filters and supports shared URLs. */
export function PageSections({
  label,
  sections,
  defaultValue,
  hashSections,
  queryKey = "view",
}: {
  label: string
  sections: readonly PageSection[]
  defaultValue: string
  hashSections?: Readonly<Record<string, string>>
  queryKey?: string
}) {
  const params = useSearchParams()
  const pathname = usePathname()
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => "",
  )
  const requested = params.get(queryKey) ?? hashSections?.[hash] ?? defaultValue
  const selected = Arr.findFirst(
    sections,
    (item) => item.value === requested,
  ).pipe(
    Option.map((item) => item.value),
    Option.getOrElse(() => defaultValue),
  )
  return (
    <Tabs
      value={selected}
      onValueChange={(value) => {
        if (typeof value !== "string" || value === selected) {
          return
        }
        const query = new URLSearchParams(window.location.search)
        query.set(queryKey, value)
        window.history.pushState(null, "", `${pathname}?${query}`)
      }}
      className="gap-5"
    >
      <TabsList
        variant="line"
        aria-label={label}
        className="w-full flex-wrap justify-start gap-x-2 gap-y-1 border-b border-border p-0 pb-2 [&_[data-slot=tabs-trigger]]:min-h-10 sm:[&_[data-slot=tabs-trigger]]:min-h-8 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:px-3 [&_[data-slot=tabs-trigger]]:text-xs"
      >
        {sections.map((section) => (
          <TabsTrigger key={section.value} value={section.value}>
            {section.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {sections.map((section) => (
        <TabsContent
          key={section.value}
          value={section.value}
          keepMounted={section.keepMounted}
          className="grid gap-5 text-base"
        >
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            {section.description}
          </p>
          {section.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
