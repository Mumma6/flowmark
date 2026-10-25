import { cn } from "@flowmark/ui"

// Decorative SVG adapted from Aceternity UI Spotlight.
// Source: https://ui.aceternity.com/registry/spotlight.json

type SpotlightProps = {
  className?: string
}

export function Spotlight({ className }: SpotlightProps) {
  return (
    <svg
      className={cn(
        "pointer-events-none absolute top-[-12%] left-1/2 z-0 h-full w-[min(100%,1200px)] -translate-x-1/2 animate-spotlight fill-primary opacity-[0.34] motion-reduce:animate-none motion-reduce:opacity-10",
        className,
      )}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
      aria-hidden="true"
    >
      <g filter="url(#flowmark-spotlight)">
        <ellipse
          cx="1924.71"
          cy="273.501"
          rx="1924.71"
          ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill="currentColor"
          fillOpacity="0.21"
        />
      </g>
      <defs>
        <filter
          id="flowmark-spotlight"
          x="0.860352"
          y="0.838989"
          width="3785.16"
          height="2840.26"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="151"
            result="effect1_foregroundBlur_1065_8"
          />
        </filter>
      </defs>
    </svg>
  )
}
