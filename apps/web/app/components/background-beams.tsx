import { cn } from "@flowmark/ui"

// Decorative SVG adapted from Aceternity UI Background Beams.
// Source: https://ui.aceternity.com/registry/background-beams.json

const paths = [
  "M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875",
  "M-352 -221C-352 -221 -284 184 180 311C644 438 712 843 712 843",
  "M-324 -253C-324 -253 -256 152 208 279C672 406 740 811 740 811",
  "M-296 -285C-296 -285 -228 120 236 247C700 374 768 779 768 779",
  "M-268 -317C-268 -317 -200 88 264 215C728 342 796 747 796 747",
  "M-240 -349C-240 -349 -172 56 292 183C756 310 824 715 824 715",
  "M-212 -381C-212 -381 -144 24 320 151C784 278 852 683 852 683",
  "M-184 -413C-184 -413 -116 -8 348 119C812 246 880 651 880 651",
  "M-156 -445C-156 -445 -88 -40 376 87C840 214 908 619 908 619",
  "M-128 -477C-128 -477 -60 -72 404 55C868 182 936 587 936 587",
] as const

export function BackgroundBeams({
  className,
  id = "hero",
}: {
  className?: string
  id?: string
}) {
  const washId = `flowmark-beam-wash-${id}`
  const travelId = `flowmark-beam-travel-${id}`

  return (
    <svg
      className={cn(
        "pointer-events-none absolute inset-0 z-0 h-full w-full opacity-70 motion-reduce:opacity-20",
        className,
      )}
      viewBox="0 0 696 316"
      fill="none"
      aria-hidden="true"
    >
      {paths.map((path) => (
        <path
          key={path}
          d={path}
          stroke={`url(#${washId})`}
          strokeOpacity="0.32"
          strokeWidth="0.6"
        />
      ))}
      {paths.slice(0, 4).map((path, index) => (
        <path
          key={`${path}-travel`}
          d={path}
          className={cn(
            "animate-beam-travel motion-reduce:animate-none",
            index === 1 && "[animation-delay:1.6s]",
            index === 2 && "[animation-delay:3.2s]",
            index === 3 &&
              "[animation-delay:4.8s] [animation-direction:reverse]",
            index % 2 === 1 && index !== 3 && "[animation-direction:reverse]",
          )}
          stroke={`url(#${travelId})`}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      ))}
      <defs>
        <radialGradient
          id={washId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(352 34) rotate(90) scale(555 1560)"
        >
          <stop offset="0" stopColor="#b9f597" stopOpacity="0.55" />
          <stop offset="1" stopColor="#b9f597" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={travelId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b9f597" stopOpacity="0" />
          <stop offset="45%" stopColor="#b9f597" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#b9f597" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
