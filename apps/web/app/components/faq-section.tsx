import type { ReactNode } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@flowmark/ui"
import {
  overlineClassName,
  sectionTitleClassName,
  shellClassName,
} from "./shell"

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
    body: "Execution volume, completion rate, duration trends, operation timings, failure codes, peer comparisons, and declared business-outcome trends. Seven-day comparisons connect changes in duration and completion to recorded operations and failure codes.",
  },
  {
    value: "result",
    title: "What is a reported result?",
    body: "A small JSON summary the application attaches on done() or fail() — imported and skipped counts, a shipment id, how far a sync got. It is evidence the application reported, not verified business correctness. Failed and partial runs can carry one too. Declare which fields have business meaning to follow their results across executions, with coverage and a path back to the contributing runs.",
  },
  {
    value: "framework",
    title: "Do I need a workflow framework?",
    body: "No. Add markers around ordinary TypeScript functions and Promises. A workflow is the process name you choose. Flowmark does not execute, schedule, or retry that work.",
  },
  {
    value: "business",
    title: "Can product and support use the same data?",
    body: "Yes. Product can read reported outcomes and trends. Support can find a case by a business reference. Engineering can inspect the operations, progress, and errors behind that same execution. Everyone works from the same application-reported facts, at the level of detail they need.",
  },
  {
    value: "errors",
    title: "How do I record errors?",
    body: (
      <>
        Use{" "}
        <code className="font-mono text-[0.92em] text-primary">
          error({"{ handled: true }"})
        </code>{" "}
        for a recovered problem, and{" "}
        <code className="font-mono text-[0.92em] text-primary">done()</code> or{" "}
        <code className="font-mono text-[0.92em] text-primary">fail()</code> for
        the terminal outcome. A failed operation can sit next to a completed run
        when your code recovered.
      </>
    ),
  },
  {
    value: "browser",
    title: "Can I instrument browser code?",
    body: (
      <>
        Yes. The{" "}
        <code className="font-mono text-[0.92em] text-primary">
          @flowmarkdev/node/browser
        </code>{" "}
        entry point uses public browser keys with allowed origins, or a
        same-origin server proxy. Keep secret server keys on the server.
      </>
    ),
  },
  {
    value: "start",
    title: "How do I start?",
    body: "Create a project and server-write key in the dashboard, install @flowmarkdev/node, and configure the API origin and key on the server. Mark one process and handle delivery at its process boundary. The docs cover Node.js, Next.js, browser setup, and self-hosting.",
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
