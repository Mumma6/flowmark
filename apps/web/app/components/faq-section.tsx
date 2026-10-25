import type { ReactNode } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@flowmark/ui"
import { overlineClassName, sectionTitleClassName, shellClassName } from "./layout"

const questions: ReadonlyArray<{
  value: string
  title: string
  body: ReactNode
}> = [
  {
    value: "what-to-mark",
    title: "What should I instrument?",
    body: "A named business process you already run — checkout, a sync, a nightly job, an import. Give it a stable name, attach the order or batch id, and report the result your code already computed.",
  },
  {
    value: "insights",
    title: "What insights do I get?",
    body: "Volume, week-over-week change, success rate, median and p95 duration, slowest operations, failure codes, last-reported progress, and the business result. Open a run to compare it with the last 20 of the same process.",
  },
  {
    value: "performance",
    title: "Can I measure how long work takes?",
    body: "Yes. Each run has median and p95 duration. Wrap a payment, write, or provider call in operation() to see which step is slow, and compare one run to the last 20 of the same workflow.",
  },
  {
    value: "result",
    title: "What is a reported result?",
    body: "A small JSON summary your code attaches on done() or fail() — imported and skipped counts, a shipment id, how far a sync got. Operations reads that first, then opens the timeline if they need the story.",
  },
  {
    value: "framework",
    title: "Do I need a workflow framework?",
    body: "No. Add markers around ordinary TypeScript functions and Promises. A workflow is the process name you choose.",
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
    body: "Create a Flowmark client, mark one process, and open it in the dashboard. The SDK docs cover Node.js, Next.js, and the browser.",
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
