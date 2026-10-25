import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page"
import { mdxComponents } from "../../mdx-components"
import { source } from "@/lib/source"

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  if (!slug?.length) {
    redirect("/docs/introduction")
  }
  const page = source.getPage(slug)
  if (!page) {
    notFound()
  }
  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={mdxComponents} />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}): Promise<Metadata> {
  const page = source.getPage((await params).slug)
  if (!page) {
    notFound()
  }
  return {
    title: page.data.title,
    description: page.data.description,
  }
}
