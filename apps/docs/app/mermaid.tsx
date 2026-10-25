"use client"

import { useEffect, useId, useState } from "react"

export function Mermaid({ chart }: { chart: string }) {
  const reactId = useId()
  const [svg, setSvg] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      try {
        const { default: mermaid } = (await import(
          "mermaid/dist/mermaid.esm.min.mjs"
        )) as typeof import("mermaid")
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: document.documentElement.classList.contains("dark")
            ? "dark"
            : "neutral",
        })
        const result = await mermaid.render(
          `flowmark-mermaid-${reactId.replaceAll(":", "")}`,
          chart.trim(),
        )
        if (!cancelled) {
          setSvg(result.svg)
        }
      } catch {
        if (!cancelled) {
          setFailed(true)
        }
      }
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [chart, reactId])

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
