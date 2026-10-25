import { DocsLayout } from "fumadocs-ui/layouts/notebook"
import type { ReactNode } from "react"
import { source } from "@/lib/source"

export default function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{ title: "Flowmark / Docs", url: "/docs/introduction", mode: "top" }}
      links={[
        {
          type: "menu",
          text: "Guides",
          on: "nav",
          items: [
            { text: "Getting started", url: "/docs/sdk" },
            { text: "Core concepts", url: "/docs/concepts/runs" },
            { text: "Next.js", url: "/docs/nextjs" },
            { text: "Browser", url: "/docs/browser" },
          ],
        },
        {
          text: "SDK reference",
          url: "/docs/reference",
          active: "nested-url",
          on: "nav",
        },
        {
          type: "menu",
          text: "Operate Flowmark",
          on: "nav",
          items: [
            { text: "Self-hosting", url: "/docs/local-development" },
            { text: "HTTP API", url: "/docs/api" },
            { text: "Security and privacy", url: "/docs/security-privacy" },
            { text: "Troubleshooting", url: "/docs/troubleshooting" },
          ],
        },
      ]}
      sidebar={{ defaultOpenLevel: 1 }}
    >
      {children}
    </DocsLayout>
  )
}
