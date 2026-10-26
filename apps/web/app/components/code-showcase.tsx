"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flowmark/ui"
import { examples } from "./code-examples"
import { overlineClassName } from "./shell"
import { RunPreview } from "./run-preview"
import { WorkflowCodeBlock } from "./workflow-code-block"

function ExamplePanel({ example }: { example: (typeof examples)[number] }) {
  const [version, setVersion] = useState("instrumented")
  const addedLines =
    example.code.split("\n").length - example.existingCode.split("\n").length

  return (
    <TabsContent className="min-w-0 w-full" value={example.id}>
      <div className="max-w-[760px] py-8">
        <h3 className="text-[clamp(1.4rem,2.4vw,1.875rem)] font-medium leading-snug tracking-tight">
          {example.question}
        </h3>
        <p className="mt-3 max-w-[650px] text-sm leading-7 text-muted-foreground">
          {example.description}
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
        <div className="min-w-0 w-full">
          <div className="mb-3 flex min-h-8 flex-wrap items-baseline justify-between gap-2">
            <span className={overlineClassName}>Your code</span>
            <span className="text-[11px] text-muted-foreground">
              {addedLines} added lines. Same business logic.
            </span>
          </div>
          <Tabs
            value={version}
            onValueChange={(value) => {
              if (value === "existing" || value === "instrumented") {
                setVersion(value)
              }
            }}
          >
            <TabsList
              aria-label={`Compare ${example.label} code`}
              className="mb-2.5 h-auto flex-wrap justify-start gap-1 bg-transparent p-1"
            >
              <TabsTrigger value="existing">Before</TabsTrigger>
              <TabsTrigger value="instrumented">With Flowmark</TabsTrigger>
            </TabsList>
            <TabsContent value="existing">
              <WorkflowCodeBlock
                title={example.title}
                value={example.existingCode}
              />
            </TabsContent>
            <TabsContent value="instrumented">
              <WorkflowCodeBlock title={example.title} value={example.code} />
            </TabsContent>
          </Tabs>
          <p className="mt-3 text-xs leading-7 text-muted-foreground">
            {version === "existing"
              ? "Your existing function. Add a few markers to report the process."
              : "Highlighted lines are Flowmark calls. Return values and thrown errors stay yours."}
          </p>
        </div>
        <RunPreview preview={example.preview} />
      </div>
    </TabsContent>
  )
}

export function CodeShowcase() {
  const [scenario, setScenario] = useState(examples[0]!.id)
  const example =
    examples.find((item) => item.id === scenario) ?? examples[0]!

  return (
    <div className="min-w-0 w-full">
      <Tabs
        value={scenario}
        onValueChange={(value) => {
          if (examples.some((item) => item.id === value)) {
            setScenario(value)
          }
        }}
      >
        <TabsList
          aria-label="Explore a real-world scenario"
          className="h-auto flex-wrap justify-start gap-1 border border-border bg-white/[0.02] p-1"
        >
          {examples.map((item) => (
            <TabsTrigger
              className="min-h-10 flex-none px-4"
              key={item.id}
              value={item.id}
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <ExamplePanel example={example} />
      </Tabs>
      <p className="mt-5 text-xs leading-7 text-muted-foreground">
        Interactive walkthrough with sample data. Results and checkpoints are
        reported by application code.
      </p>
    </div>
  )
}
