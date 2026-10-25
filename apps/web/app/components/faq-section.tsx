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
    value: "logging",
    title: "Is this another logging tool?",
    body: "Flowmark is organized around business processes and what they produced — not a stream of log messages. Operations can review steps, progress, errors, and the reported result in one timeline. It does not collect all your application logs.",
  },
  {
    value: "cloud-logs",
    title: "How does it fit with my cloud provider’s logs and metrics?",
    body: "Keep them. Infrastructure metrics explain resource usage and service health; logs capture technical details. Flowmark adds the process you explicitly name: which import ran, which milestones it reached, and what it reported. A healthy HTTP endpoint does not, by itself, describe an entire import.",
  },
  {
    value: "logger",
    title: "Can I keep my existing logger?",
    body: "Yes. Keep writing diagnostic messages with your logger and add Flowmark markers where you need the story of one execution. Include the same application-defined identifier, such as an order id or job id, in both places. There is no automatic log forwarding or cross-tool linking.",
  },
  {
    value: "existing-observability",
    title: "What if I already use Axiom, Better Stack, or Datadog?",
    body: "Those platforms already support powerful observability workflows. Flowmark is a focused model and interface for the processes you instrument, not a replacement stack. If your current dashboards already give you that view of one execution, you may not need another tool. There are no native integrations with those platforms.",
  },
  {
    value: "product-analytics",
    title: "How is this different from product analytics such as PostHog?",
    body: "Product analytics commonly examines user behavior, adoption, and conversion. Flowmark focuses on a specific execution — its operations, progress, errors, and result — whether a person or a background job triggered it.",
  },
  {
    value: "structured-logs",
    title: "Could I build this with structured logs myself?",
    body: "Yes. Structured logs, shared identifiers, and custom queries can represent much of the same information. Flowmark packages the SDK conventions, validation, persistence, summaries, and timeline so you do not have to maintain that view yourself. The distinction is the focused developer experience, not exclusive access to the data.",
  },
  {
    value: "workflow-framework",
    title: "Do I need a workflow framework?",
    body: "No. Track a form submission, payment, import, or background job in ordinary application code. A workflow is simply the process you choose to follow. Flowmark does not automatically discover your processes.",
  },
  {
    value: "workflow-engine",
    title: "Is Flowmark a workflow engine?",
    body: "No. Flowmark records workflows your application runs. It does not schedule or execute them. You choose a process and add SDK markers; Flowmark records the context, steps, errors, and outcomes you report.",
  },
  {
    value: "error-recovery",
    title: "Does Flowmark decide whether an error is recovered?",
    body: (
      <>
        No. Your code decides whether to handle an error and whether a workflow
        succeeded. Record recoverable errors with{" "}
        <code className="font-mono text-[0.92em] text-[#c5d9bb]">
          error({"{ handled: true }"})
        </code>
        , and terminal outcomes with{" "}
        <code className="font-mono text-[0.92em] text-[#c5d9bb]">done()</code>{" "}
        or <code className="font-mono text-[0.92em] text-[#c5d9bb]">fail()</code>
        .
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
        entry point supports public browser keys with allowed origins or a
        same-origin server proxy. Never put a secret server key in frontend
        code. Browser events are untrusted telemetry, not proof of a business
        result.
      </>
    ),
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
        <p className={overlineClassName}>Product boundaries</p>
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
