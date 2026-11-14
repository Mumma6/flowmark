"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flowmark/ui"

const perspectives = [
  {
    id: "engineering",
    name: "Engineering",
    question: "What changed after the release?",
    answer:
      "Confirmations fell by 16 percentage points. Execution completion stayed at 99.3% in both cohorts.",
    context: "Release comparison → contributing runs → code",
  },
  {
    id: "product",
    name: "Product",
    question: "Are bookings reaching their intended outcome?",
    answer:
      "532 of 700 eligible bookings have a confirmation within 20 minutes, down from 644 of 700 in the previous cohort.",
    context: "Business outcome → comparable population → history",
  },
  {
    id: "operations",
    name: "Operations",
    question: "Where does this process need attention?",
    answer:
      "168 of 700 eligible bookings have no confirmation recorded within the declared 20-minute window.",
    context: "Process health → outstanding expectations → journeys",
  },
  {
    id: "success",
    name: "Customer Success",
    question: "What happened to this booking?",
    answer:
      "The application reports acceptance by Orbit. Its expected confirmation isn’t recorded at the observation time.",
    context: "Business reference → booking journey → evidence",
  },
] as const

export function SharedUnderstanding() {
  return (
    <Tabs defaultValue="engineering" className="gap-0">
      <TabsList
        aria-label="Explore team perspectives"
        variant="line"
        className="grid w-full grid-cols-2 gap-1 border-b border-border p-0 sm:flex sm:justify-start sm:gap-5"
      >
        {perspectives.map((item) => (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className="h-12 text-[11px] after:bottom-0 sm:flex-none sm:px-0"
          >
            {item.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {perspectives.map((item) => (
        <TabsContent key={item.id} value={item.id} className="pt-7">
          <h3 className="text-2xl leading-snug font-medium tracking-tight">
            {item.question}
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            {item.answer}
          </p>
          <p className="mt-6 text-[10px] leading-6 text-highlight">
            {item.context}
          </p>
        </TabsContent>
      ))}
    </Tabs>
  )
}
