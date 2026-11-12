"use client"

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@flowmark/ui"
import { ArrowUpRight } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useProject } from "../../projects/project-context"
import { readInspectorRunId } from "./investigation-navigation"
import { useRunDetail } from "../queries"
import { RunDetailContent } from "./run-detail-content"

export function RunInspector({ id }: { id: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { current } = useProject()
  const [projectId] = useState(current?.id)
  const [open, setOpen] = useState(true)
  const [returnFocus] = useState(() =>
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )
  const title = useRef<HTMLHeadingElement>(null)
  const sameProject = Boolean(projectId && current?.id === projectId)
  const queries = useRunDetail(id, params, sameProject)

  useEffect(() => {
    if (!sameProject) {
      router.replace("/", { scroll: false })
    }
  }, [sameProject, router])

  if (!sameProject) {
    return null
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false)
          window.history.back()
        }
      }}
    >
      <SheetContent
        closeLabel="Close run inspector"
        initialFocus={title}
        finalFocus={() =>
          (returnFocus?.isConnected ? returnFocus : null) ??
          document.querySelector<HTMLElement>(
            `[data-run-id="${CSS.escape(id)}"]`,
          ) ??
          document.getElementById("journey-title") ??
          document.getElementById("evidence-title") ??
          document.getElementById("studio-main")
        }
        className="left-auto right-0 w-full max-w-none gap-0 border-l border-highlight/40 border-r-0 bg-card p-0 shadow-2xl md:w-[calc(100vw-10rem)] xl:w-[min(1100px,calc(100vw-24rem))]"
      >
        <header className="shrink-0 border-b border-highlight/30 bg-highlight/5 px-5 py-5 pr-12 sm:px-7 sm:pr-12">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-highlight">
            Studio / Run inspector
          </p>
          <SheetTitle
            ref={title}
            tabIndex={-1}
            className="break-words font-mono text-lg font-medium tracking-tight"
          >
            {queries.detail.data?.[0]?.workflow ?? "Execution evidence"}
          </SheetTitle>
          <SheetDescription className="mt-2 break-all font-mono text-[10px]">
            {queries.detail.data?.[0]?.externalId ?? id}
          </SheetDescription>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Your Explore selection stays in place.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={`${pathname}${params.size ? `?${params}` : ""}`}>
                Open full page
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </a>
            </Button>
          </div>
        </header>
        <div
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7"
          onClickCapture={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              !(event.target instanceof Element)
            ) {
              return
            }
            const link = event.target.closest<HTMLAnchorElement>("a[href]")
            if (!link || link.target || link.hasAttribute("download")) {
              return
            }
            const next = new URL(link.href)
            if (
              next.origin !== window.location.origin ||
              !readInspectorRunId(next.pathname)
            ) {
              return
            }
            event.preventDefault()
            window.history.replaceState(
              null,
              "",
              `${next.pathname}${next.search}${next.hash}`,
            )
          }}
        >
          <RunDetailContent id={id} queries={queries} contextual />
        </div>
      </SheetContent>
    </Sheet>
  )
}
