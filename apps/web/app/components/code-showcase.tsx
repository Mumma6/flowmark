"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flowmark/ui"
import { examples } from "./code-examples"
import { RunPreview } from "./run-preview"
import { WorkflowCodeBlock } from "./workflow-code-block"

function ExamplePanel({ example }: { example: (typeof examples)[number] }) {
  const [version, setVersion] = useState("instrumented")
  const addedLines =
    example.code.split("\n").length - example.existingCode.split("\n").length

  return (
    <TabsContent className="code-tab-content" value={example.id}>
      <div className="scenario-intro">
        <h3>{example.question}</h3>
        <p>{example.description}</p>
      </div>
      <div className="scenario-workspace">
        <div className="scenario-code">
          <div className="scenario-column-heading">
            <span className="overline">YOUR CODE</span>
            <span>{addedLines} added lines. Same business logic.</span>
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
              className="code-tabs comparison-tabs"
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
          <p className="scenario-code-note">
            {version === "existing"
              ? "The application already does the work. Flowmark adds visibility, not a new execution model."
              : "Highlighted lines are Flowmark calls. Existing return values, logs, and thrown errors stay intact."}
          </p>
        </div>
        <RunPreview preview={example.preview} />
      </div>
    </TabsContent>
  )
}

export function CodeShowcase() {
  return (
    <div className="code-showcase">
      <Tabs defaultValue="import">
        <TabsList
          aria-label="Explore a real-world scenario"
          className="code-tabs scenario-tabs"
        >
          {examples.map((example) => (
            <TabsTrigger
              className="code-tab"
              key={example.id}
              value={example.id}
            >
              {example.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {examples.map((example) => (
          <ExamplePanel key={example.id} example={example} />
        ))}
      </Tabs>
      <p className="walkthrough-note">
        Interactive walkthrough with sample data. Results and checkpoints are
        reported by application code.
      </p>
    </div>
  )
}
