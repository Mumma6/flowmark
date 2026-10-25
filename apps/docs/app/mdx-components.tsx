import defaultMdxComponents from "fumadocs-ui/mdx"
import type { ComponentProps, ReactNode } from "react"
import { isValidElement } from "react"
import { Mermaid } from "./mermaid"

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }
  if (!node) {
    return ""
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("")
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children)
  }
  return ""
}

function languageOf(node: ReactNode): string | undefined {
  if (!isValidElement<{ className?: string; children?: ReactNode }>(node)) {
    return undefined
  }
  const match = /language-([^\s]+)/.exec(node.props.className ?? "")
  if (match) {
    return match[1]
  }
  return languageOf(node.props.children)
}

const isMermaidSource = (chart: string) =>
  /^(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram|mindmap|timeline)\b/.test(
    chart.trim(),
  )

export const mdxComponents = {
  ...defaultMdxComponents,
  pre(props: ComponentProps<"pre">) {
    const chart = textOf(props.children)
    if (languageOf(props.children) === "mermaid" || isMermaidSource(chart)) {
      return <Mermaid chart={chart} />
    }
    return <defaultMdxComponents.pre {...props} />
  },
}
