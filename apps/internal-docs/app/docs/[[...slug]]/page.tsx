import { notFound } from "next/navigation"
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page"
import { source } from "@/lib/source"
import { ArchitectureOverview } from "../../architecture-overview"

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const slug = (await params).slug
  const page = source.getPage(slug)
  if (!page) {
    notFound()
  }
  const MDX = page.data.body
  const architecture = slug?.length === 1 && slug[0] === "architecture"

  return (
    <DocsPage toc={architecture ? [] : page.data.toc} full={architecture}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        {architecture ? (
          <>
            <ArchitectureOverview />
            <details className="arch-technical-details">
              <summary>
                Detailed contracts, security boundaries and storage behavior
              </summary>
              <MDX />
            </details>
          </>
        ) : (
          <MDX />
        )}
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}
