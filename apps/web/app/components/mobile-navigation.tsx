"use client"

import { useState } from "react"
import {
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@flowmark/ui"
import { navigation, githubUrl } from "./site-links"

export function MobileNavigation() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            className="size-11 p-0 md:hidden"
            aria-label="Open navigation"
          />
        }
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M3 6h14M3 10h14M3 14h14"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </SheetTrigger>
      <SheetContent className="bg-background p-6">
        <SheetTitle>Explore Flowmark</SheetTitle>
        <SheetDescription>
          Application memory for AI-native software teams.
        </SheetDescription>
        <nav aria-label="Mobile navigation" className="mt-8 grid gap-2">
          {[
            ...navigation,
            { label: "GitHub", href: githubUrl },
            { label: "Join the waitlist", href: "#waitlist" },
          ].map((item) => (
            <a
              key={item.label}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-base transition-colors hover:bg-secondary hover:text-primary"
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
