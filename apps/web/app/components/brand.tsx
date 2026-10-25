import { FlowmarkWordmark } from "@flowmark/ui"

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrandLink({ href = "/" }: { href?: string }) {
  return (
    <a href={href} aria-label="Flowmark home">
      <FlowmarkWordmark />
    </a>
  )
}
