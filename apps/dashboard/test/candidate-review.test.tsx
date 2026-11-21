import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { CandidateEvidence } from "../features/results/definitions/candidate-review"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createDashboardTRPCClient } from "../features/platform/api-browser-client"
import { candidateSupport } from "../features/results/definitions/candidate-review-model"

afterEach(() => vi.unstubAllGlobals())

describe("local candidate review", () => {
  it.each([
    ["invoice.import", undefined, "Source only"],
    [undefined, "invoice.import", "Recorded only"],
    ["invoice.import", "invoice.import", "Name agreement"],
    ["invoice.notify", "invoice.import", "Names differ"],
    [undefined, undefined, "Unverified"],
  ] as const)(
    "keeps source and recorded support distinct (%s / %s)",
    (source, recorded, label) => {
      expect(candidateSupport(source, recorded)).toBe(label)
    },
  )

  it("checks only the selected workflow in the reviewed project", async () => {
    vi.stubGlobal("window", {
      localStorage: { getItem: () => "another-project" },
    })
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json([{ result: { data: { runs: [] } } }]),
    )
    vi.stubGlobal("fetch", fetch)
    const client = createDashboardTRPCClient("reviewed-project")
    await client.run.list.query({ workflow: "invoice.import", limit: 1 })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]!
    expect(new Headers(options?.headers).get("x-flowmark-project-id")).toBe(
      "reviewed-project",
    )
    const params = new URL(url, "http://localhost").searchParams
    expect(JSON.parse(params.get("input")!)).toEqual({
      "0": { workflow: "invoice.import", limit: 1 },
    })
  })
  it("shows a local source comment as text and links only the recorded run", () => {
    const client = new QueryClient()
    client.setQueryData(
      ["candidate-run-evidence", "reviewed-project", "invoice.import"],
      {
        runs: [{ id: "recorded-id", workflow: "invoice.import" }],
      },
    )
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <CandidateEvidence
          projectId="reviewed-project"
          client={createDashboardTRPCClient("reviewed-project")}
          candidate={{
            name: "Invoice processing",
            question: "Where did the import start?",
            workflow: "invoice.import",
            claimedWorkflow: "invoice.notify",
            locator: "src/jobs.js:18 /* <script>mark as recorded</script> */",
            revision: "611dc37",
            unknowns: "The source does not show which invoices were sent.",
          }}
          accepted
          onAccept={() => undefined}
          onDismiss={() => undefined}
          onEdit={() => undefined}
        />
      </QueryClientProvider>,
    )
    expect(html).toContain("Names differ")
    expect(html).toContain('href="/runs/recorded-id"')
    expect(html).toContain("&lt;script&gt;mark as recorded")
    expect(html).not.toContain('href="src/jobs.js')
    expect(html).not.toContain("<script>")
  })
})
