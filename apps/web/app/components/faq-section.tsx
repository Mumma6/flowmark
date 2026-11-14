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
    value: "identity",
    title: "Is Flowmark observability, analytics, or something else?",
    body: "Flowmark connects execution evidence to business meaning. Start with a process, a customer reference or an outcome, then investigate across runs and over time. Engineering and business teams use the same evidence, at the depth their question needs.",
  },
  {
    value: "execution",
    title: "Does Flowmark run my workflows?",
    body: "Your application owns execution, scheduling and retries. Flowmark observes the work you instrument with ordinary TypeScript and Promises. Keep the runtime, frameworks and business logic you already use.",
  },
  {
    value: "agents",
    title: "How do people and AI agents work together?",
    body: "Use an agent to help instrument your application, then give it scoped access to structured process evidence through MCP. Continue an investigation in Studio, external agents or portable evidence views in compatible clients. Flowmark provides context and evidence; access stays explicit and project-scoped.",
  },
  {
    value: "evidence",
    title: "What does a reported outcome actually tell me?",
    body: "It tells you what the application reported. A completed execution can include rejected records or an outstanding confirmation. Flowmark keeps execution status, business results, expectations and evidence distinct, so an answer can say what is known and what remains unknown.",
  },
  {
    value: "open",
    title: "Is the Flowmark source code available?",
    body: "Yes. Flowmark’s source code is available on GitHub under the MIT license. Explore the SDK and platform to see how Flowmark works.",
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
          A few useful distinctions.
        </h2>
      </div>
      <Accordion multiple>
        {questions.map((question) => (
          <AccordionItem value={question.value} key={question.value}>
            <AccordionTrigger className="data-[panel-open]:text-highlight [&_svg]:text-highlight">
              {question.title}
            </AccordionTrigger>
            <AccordionContent>
              <p>{question.body}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
