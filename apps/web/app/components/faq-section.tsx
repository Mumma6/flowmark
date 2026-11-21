import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@flowmark/ui"
import { sectionTitleClassName, shellClassName } from "./shell"

import copy from "../../public/landing-page-copy.en.json"

const questions = copy.faq.items

export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="border-t border-border"
    >
      <div
        className={`${shellClassName} grid gap-6 py-16 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:gap-16`}
      >
        <h2 id="faq-title" className={sectionTitleClassName}>
          {copy.faq.heading}
        </h2>
        <Accordion multiple defaultValue={[questions[0].question]}>
          {questions.map(({ question, answer }) => (
            <AccordionItem value={question} key={question}>
              <AccordionTrigger className="aria-expanded:text-primary">
                {question}
              </AccordionTrigger>
              <AccordionContent>{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
