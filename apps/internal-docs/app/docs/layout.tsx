import { DocsLayout } from "fumadocs-ui/layouts/docs"
import type { ReactNode } from "react"
import { source } from "@/lib/source"

export default function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <DocsLayout tree={source.pageTree} nav={{ title: "Flowmark internal" }}>
      {children}
    </DocsLayout>
  )
}
