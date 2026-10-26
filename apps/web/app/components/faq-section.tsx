import type { ReactNode } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@flowmark/ui"
import { overlineClassName, sectionTitleClassName, shellClassName } from "./shell"

const questions: ReadonlyArray<{
  value: string
  title: string
  body: ReactNode
}> = [
  {
    value: "what-to-mark",
    title: "What should I instrument?",
    body: "A named process the application already runs: an import, a checkout, a sync, a job that continues across later requests. It earns its place when someone needs to understand one execution, the code has progress or a result to report, and logs or an APM do not already give that view. An ordinary create or update endpoint, where one request log is enough, is a weak fit.",
  },
  {
    value: "insights",
    title: "What insights do I get?",
    body: "Today: volume, week-over-week change, success rate, median and p95 duration, slowest operations, failure codes, last-reported progress, a few scalar result highlights, and a duration comparison with recent peers of the same workflow. The product is also for a change you can attribute — which operation slowed, which failure codes account for a drop, what the runs reported accomplishing — and that reading is still ahead.",
  },
  {
    value: "performance",
    title: "Can I measure how long work takes?",
    body: "Yes. Each run has median and p95 duration. Wrap a payment, write, or provider call in operation() to see which step is slow, and compare one run to the last 20 of the same workflow.",
  },
  {
    value: "result",
    title: "What is a reported result?",
    body: "A small JSON summary the application attaches on done() or fail() — imported and skipped counts, a shipment id, how far a sync got. It is evidence the application reported, not verified business correctness. Failed and partial runs can carry one too. Following those fields across runs is still ahead.",
  },
  {
    value: "framework",
    title: "Do I need a workflow framework?",
    body: "No. Add markers around ordinary TypeScript functions and Promises. A workflow is the process name you choose. Flowmark does not execute, schedule, or retry that work.",
  },
  {
    value: "errors",
    title: "How do I record errors?",
    body: (
      <>
        Use{" "}
        <code className="font-mono text-[0.92em] text-[#c5d9bb]">
          error({"{ handled: true }"})
        </code>{" "}
        for a recovered problem, and{" "}
        <code className="font-mono text-[0.92em] text-[#c5d9bb]">done()</code>{" "}
        or{" "}
        <code className="font-mono text-[0.92em] text-[#c5d9bb]">fail()</code>{" "}
        for the terminal outcome. A failed operation can sit next to a
        completed run when your code recovered.
      </>
    ),
  },
  {
    value: "browser",
    title: "Can I instrument browser code?",
    body: (
      <>
        Yes. The{" "}
        <code className="font-mono text-[0.92em] text-[#c5d9bb]">
          @flowmark/node/browser
        </code>{" "}
        entry point uses public browser keys with allowed origins, or a
        same-origin server proxy. Keep secret server keys on the server.
      </>
    ),
  },
  {
    value: "start",
    title: "How do I start?",
    body: "Create a project in the dashboard, copy the agent prompt from Getting started or Settings, and mark one process. The SDK docs cover Node.js, Next.js, and the browser. The npm package is not published yet.",
  },
  {
    value: "ahead",
    title: "What is not in the product yet?",
    body: "Search beyond the latest runs, outcome trends, a waterfall, comparison deeper than overall duration, and automatic signals for a meaningful change. They are part of the product this page describes. They are not in the dashboard yet.",
  },
]

export function FaqSection() {
  return (
    <section
      id="faq"
      className={`${shellClassName} grid gap-8 py-16 sm:py-[6.25rem] lg:grid-cols-[0.8fr_1.2fr] lg:gap-20`}
      aria-labelledby="faq-title"
    >
      <div>
        <p className={overlineClassName}>Questions</p>
        <h2 id="faq-title" className={`${sectionTitleClassName} mt-4`}>
          Questions, answered.
        </h2>
      </div>
      <Accordion multiple>
        {questions.map((question) => (
          <AccordionItem value={question.value} key={question.value}>
            <AccordionTrigger>{question.title}</AccordionTrigger>
            <AccordionContent>
              <p>{question.body}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
