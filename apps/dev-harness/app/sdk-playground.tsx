"use client"

import { useState } from "react"
import { Schema } from "effect"
import { createFlowmark, defineConfig } from "@flowmarkdev/node/browser"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@flowmark/ui"
import config from "../flowmark.config"
import { runScenario, scenarios, type ScenarioId } from "../lib/sdk-scenarios"

const ResultSchema = Schema.Struct({
  runs: Schema.Array(
    Schema.Struct({ runId: Schema.String, name: Schema.String }),
  ),
  correlationId: Schema.String,
})

type Runtime = "browser" | "next" | "node"
type Result = typeof ResultSchema.Type
type CaseState = { result?: Result; error?: string; pending?: boolean }

export function SdkPlayground() {
  const [runtime, setRuntime] = useState<Runtime>("browser")
  const [states, setStates] = useState<Record<string, CaseState>>({})

  async function execute(id: ScenarioId) {
    const key = `${runtime}:${id}`
    setStates((previous) => ({ ...previous, [key]: { pending: true } }))
    try {
      let result: Result
      if (runtime === "browser") {
        // Each diagnostic owns its client and isolated-project credentials.
        const client = createFlowmark(defineConfig(config))
        try {
          result = await runScenario(client, id, "browser")
          await client.flush()
        } finally {
          await client.shutdown()
        }
      } else {
        const response = await fetch("/api/sdk-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: id, runtime }),
        })
        if (!response.ok) {
          throw new Error(
            `SDK test endpoint returned HTTP ${response.status}. Check the server console.`,
          )
        }
        result = Schema.decodeUnknownSync(ResultSchema)(await response.json())
      }
      setStates((previous) => ({ ...previous, [key]: { result } }))
    } catch (cause) {
      setStates((previous) => ({
        ...previous,
        [key]: {
          error: cause instanceof Error ? cause.message : String(cause),
        },
      }))
    }
  }

  return (
    <section className="grid min-w-0 gap-6" aria-labelledby="sdk-lab-heading">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          Isolated developer checks
        </p>
        <h1
          id="sdk-lab-heading"
          className="mt-2 text-3xl font-semibold tracking-tight"
        >
          SDK diagnostics
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          These technical checks write to a separate SDK diagnostics project,
          never the operations dashboard. Intentional failures are expected. Run
          pnpm db:setup to provision both local projects.
        </p>
      </header>
      <Tabs
        value={runtime}
        onValueChange={(value) => {
          if (value === "browser" || value === "next" || value === "node") {
            setRuntime(value)
          }
        }}
      >
        <TabsList
          aria-label="SDK runtime"
          className="h-auto w-full flex-wrap sm:w-fit"
        >
          <TabsTrigger value="browser">Browser SDK</TabsTrigger>
          <TabsTrigger value="next">Next.js adapter</TabsTrigger>
          <TabsTrigger value="node">Node SDK</TabsTrigger>
        </TabsList>
        {(["browser", "next", "node"] as const).map((mode) => (
          <TabsContent key={mode} value={mode}>
            <p className="my-5 text-sm leading-7 text-muted-foreground">
              {mode === "browser"
                ? "Public browser key → /v1/browser-events. A separate client runs flush() then shutdown() after each test."
                : mode === "next"
                  ? "Secret server key → /v1/events. The Next.js adapter uses after() to finish delivery after the response."
                  : "Secret server key → /v1/events. The route owns a plain Node client and explicitly calls flush() and shutdown()."}
            </p>
            {Array.from(
              new Set(scenarios.map((scenario) => scenario.group)),
              (group) => (
                <section className="mb-6 grid gap-4" key={group}>
                  <h2 className="text-lg font-semibold">{group}</h2>
                  <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {scenarios
                      .filter((scenario) => scenario.group === group)
                      .map((scenario) => {
                        const state = states[`${mode}:${scenario.id}`]
                        return (
                          <Card key={scenario.id}>
                            <CardHeader>
                              <CardTitle>{scenario.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                              <code className="break-words text-xs leading-6 text-primary">
                                {scenario.methods}
                              </code>
                              <p className="text-sm leading-7 text-muted-foreground">
                                <strong>Expected:</strong> {scenario.expected}
                              </p>
                              <Button
                                type="button"
                                disabled={state?.pending}
                                onClick={() => void execute(scenario.id)}
                              >
                                {state?.pending
                                  ? "Running..."
                                  : `Run ${scenario.id}`}
                              </Button>
                              {state?.error && (
                                <p
                                  className="text-sm leading-6 text-destructive"
                                  role="alert"
                                >
                                  {state.error}
                                </p>
                              )}
                              {state?.result && (
                                <div
                                  className="grid gap-3 text-xs leading-6 text-muted-foreground"
                                  role="status"
                                >
                                  <p>
                                    {mode === "next"
                                      ? "Scenario executed; delivery continues via after()."
                                      : "Scenario executed; flush and shutdown completed."}
                                  </p>
                                  <ul>
                                    {state.result.runs.map((run) => (
                                      <li key={run.runId}>
                                        <p className="break-all font-medium text-foreground">
                                          {run.name}
                                        </p>
                                        <code className="break-all">
                                          {run.runId}
                                        </code>
                                      </li>
                                    ))}
                                  </ul>
                                  <small className="break-all">
                                    Correlation: {state.result.correlationId}
                                  </small>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                  </div>
                </section>
              ),
            )}
          </TabsContent>
        ))}
      </Tabs>
      <Card>
        <CardHeader>
          <CardTitle>Where to edit</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-7 text-muted-foreground">
          <ul className="grid gap-2">
            <li>
              <code>lib/sdk-scenarios.ts</code> — isolated cases for every
              workflow method.
            </li>
            <li>
              <code>app/sdk-playground.tsx</code> — browser runtime,
              flush/shutdown and test controls.
            </li>
            <li>
              <code>app/api/sdk-tests/route.ts</code> — Next adapter vs plain
              Node lifecycle.
            </li>
            <li>
              <code>flowmark.config.ts</code> — defineConfig(), public browser
              key and origin for the isolated diagnostics project.
            </li>
          </ul>
          <p>
            History persists in the separate diagnostics project. These buttons
            are manual development checks, not a replacement for the SDK&apos;s
            automated test suite. Operations history stays clean.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
