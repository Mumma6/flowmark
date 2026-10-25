import type { ComponentProps } from "react"

export function FlowmarkMark(props: ComponentProps<"svg">) {
  return (
    <svg
      width="29"
      height="29"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M6 25V7h20M6 16h14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="25" cy="16" r="3" fill="currentColor" />
      <circle cx="16" cy="25" r="3" fill="currentColor" />
    </svg>
  )
}
