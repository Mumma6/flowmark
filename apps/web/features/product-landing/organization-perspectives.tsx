"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flowmark/ui"

const perspectives = [
  {
    role: "Engineering",
    question: "Where does the process break down?",
    answer:
      "Follow the booking into its operations, release and reported result. Compare the surrounding executions, then take the evidence into your coding agent.",
    focus: "Execution → operations → release",
    value: "1.8 s",
    label: "Booking run duration",
    detail: "Execution completed. Confirmation not recorded.",
  },
  {
    role: "Product",
    question: "Did the feature deliver the intended outcome?",
    answer:
      "Separate a completed booking request from its confirmed business outcome. Read reported outcomes over time, with coverage and a path back to the contributing runs.",
    focus: "Process → reported outcome → trend",
    value: "Not recorded",
    label: "Booking confirmation",
    detail: "A completed run is one fact. A confirmed booking is another.",
  },
  {
    role: "Customer Success",
    question: "What happened to this customer’s booking?",
    answer:
      "Find Cedar Health by its reference. See what arrived, what the integration accepted and which confirmation is outstanding, without assembling a timeline from five tools.",
    focus: "Customer → reference → connected evidence",
    value: "Cedar Health",
    label: "Customer context",
    detail: "SYN-BOOK-RECENT · Orbit Scheduling",
  },
  {
    role: "Sales",
    question: "What value is this customer receiving?",
    answer:
      "Explore the activity and outcomes the application reports for an account. Ground the conversation in observed usage and delivery, with the evidence behind each claim.",
    focus: "Account → activity → reported value",
    value: "Accepted",
    label: "Application-reported booking result",
    detail: "Acceptance is reported. Final confirmation remains unknown.",
  },
  {
    role: "Operations",
    question: "What still needs attention?",
    answer:
      "Find processes with missed expectations or deteriorating integrations. Move from the outstanding business step straight to the references and evidence needed to respond.",
    focus: "Expectation → integration → evidence",
    value: "40 min",
    label: "Past the declared deadline",
    detail: "Expected 10:20 UTC · snapshot 11:00 UTC",
  },
] as const

export function OrganizationPerspectives() {
  const [role, setRole] = useState<string>(perspectives[0].role)
  return (
    <Tabs
      value={role}
      onValueChange={(value) => {
        if (typeof value === "string") {
          setRole(value)
        }
      }}
      className="mt-10 gap-0"
    >
      <TabsList
        aria-label="Explore organizational perspectives"
        variant="line"
        className="w-full flex-wrap justify-start gap-x-6 gap-y-1 border-b border-border p-0 pb-1 sm:gap-x-9 [&_[data-slot=tabs-trigger]]:after:bg-highlight"
      >
        {perspectives.map((item) => (
          <TabsTrigger
            key={item.role}
            value={item.role}
            className="h-12 flex-none px-0 text-xs after:bottom-[-5px]"
          >
            {item.role}
          </TabsTrigger>
        ))}
      </TabsList>
      {perspectives.map((item) => (
        <TabsContent key={item.role} value={item.role} className="pt-8">
          <div className="grid gap-8 md:min-h-60 md:grid-cols-[1.2fr_1fr] lg:gap-24">
            <div>
              <h3 className="max-w-lg text-balance text-2xl leading-snug font-medium tracking-[-0.035em] sm:text-3xl">
                {item.question}
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
                {item.answer}
              </p>
              <p className="mt-5 font-mono text-[10px] text-highlight">
                {item.focus}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 sm:p-8">
              <span
                className="absolute top-0 right-8 h-10 w-px bg-linear-to-b from-highlight/60 to-transparent"
                aria-hidden="true"
              />
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Same case · SYN-BOOK-RECENT
              </p>
              <p className="mt-6 text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">
                {item.value}
              </p>
              <p className="mt-4 text-[11px] leading-6 text-muted-foreground">
                {item.detail}
              </p>
            </div>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}
