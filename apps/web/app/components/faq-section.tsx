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
    title: "What is process intelligence?",
    body: "An understanding of how your software’s processes behave and what they report accomplishing. Flowmark connects code, executions, business outcomes and history so you can follow a changed result back to its evidence — and keep that understanding current as the application changes.",
  },
  {
    value: "execution",
    title: "How does Flowmark fit into my application?",
    body: "Start with automatic technical context, agent-assisted instrumentation, or precise SDK markers. Each works independently. Your application keeps its runtime, execution and business logic; Flowmark records observations and connects them to meaningful processes.",
  },
  {
    value: "agents",
    title: "Do I need an AI agent to use Flowmark?",
    body: "Studio is a visual workspace for exploring processes, outcomes and evidence. You can browse, compare and investigate directly. Agents add another way to discover processes, prepare instrumentation changes and investigate alongside your code through scoped MCP access.",
  },
  {
    value: "evidence",
    title: "What does a reported outcome actually tell me?",
    body: "It tells you what the application reported. A completed execution can include rejected records or an outstanding confirmation. Flowmark keeps execution status, business results, expectations and evidence distinct, so an answer can say what is known and what remains unknown.",
  },
  {
    value: "open",
    title: "How can I get access?",
    body: "Join the waitlist with your email. Flowmark is preparing for public access. You can also explore the SDK, architecture and source on GitHub under the MIT license.",
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
          A little more context.
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
