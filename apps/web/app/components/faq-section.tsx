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
    body: "Volume, success rate, duration, week-over-week change, slowest operations, and failure codes — plus attributed change: which operation slowed, which codes account for a drop, and what runs reported accomplishing. Every insight links back to the executions behind it.",
  },
  {
    value: "result",
    title: "What is a reported result?",
    body: "A small JSON summary the application attaches on done() or fail() — imported and skipped counts, a shipment id, how far a sync got. It is evidence the application reported, not verified business correctness. Failed and partial runs can carry one too. Declared fields can be followed across runs and releases.",
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
    body: "Create a project in the dashboard, run npm i @flowmarkdev/node, and mark one process. The docs cover Node.js, Next.js, and the browser.",
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
