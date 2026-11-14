import type { ReactNode } from "react"
import { cn } from "@flowmark/ui"

const symbols = {
  request: (
    <>
      <path d="M8 7 3 12l5 5m8-10 5 5-5 5m-5 2 2-14" />
    </>
  ),
  booking: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="3" />
      <path d="M8 3v4m8-4v4M4 10h16m-11 5 2 2 4-4" />
    </>
  ),
  integration: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v3m11-5h3a2 2 0 0 1 2 2v3M4 15v3a2 2 0 0 0 2 2h3m6 0h3a2 2 0 0 0 2-2v-3M8 12h8m-3-3 3 3-3 3" />
    </>
  ),
  confirmation: (
    <>
      <path d="m5 12 4 4L19 6" />
      <circle cx="12" cy="12" r="10" />
    </>
  ),
  agent: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      <path d="M19 3v4m-2-2h4" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  evidence: (
    <>
      <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h5" />
    </>
  ),
  branch: (
    <>
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <path d="M6 7v10m0-5c8 0 12 0 12-5" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type ProcessIconName = keyof typeof symbols
export function ProcessIcon({
  name,
  className,
}: {
  name: ProcessIconName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-6", className)}
    >
      {symbols[name]}
    </svg>
  )
}
