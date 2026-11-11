"use client"

import { useId, useMemo } from "react"
import { useAsyncResource } from "./hooks/use-async-resource"

const renderDiagram = async ({
  id,
  chart,
}: {
  readonly id: string
  readonly chart: string
}) => {
  const { default: mermaid } = await import("mermaid")
  mermaid.initialize({
    startOnLoad: false,
    // React owns the accessible source fallback; Mermaid must not inject a second error view.
    suppressErrorRendering: true,
    securityLevel: "strict",
    theme: document.documentElement.classList.contains("dark")
      ? "dark"
      : "neutral",
  })
  const result = await mermaid.render(id, chart)

  return result.svg
}

export function Mermaid({ chart }: { chart: string }) {
  const reactId = useId()
  const key = useMemo(
    () => ({
      id: `flowmark-mermaid-${reactId.replaceAll(":", "")}`,
      chart: chart.trim(),
    }),
    [reactId, chart],
  )
  const resource = useAsyncResource(key, renderDiagram)
  const svg = resource?.kind === "ready" ? resource.value : undefined
  const failed = resource?.kind === "failed"

  if (failed) {
    return (
      <pre>
        <code>{chart.trim()}</code>
      </pre>
    )
  }

  return (
    <figure className="my-6 overflow-x-auto" aria-label="Flow API diagram">
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <p className="text-sm text-fd-muted-foreground">Loading diagram</p>
      )}
    </figure>
  )
}
