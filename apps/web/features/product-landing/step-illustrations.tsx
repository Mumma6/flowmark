import { MotionScene, SignalPath } from "./motion"

function Connect() {
  return (
    <>
      <SignalPath d="M0 67 H74" className="text-highlight" />
      <SignalPath d="M174 67 H250" />
      <g strokeWidth="1.5" strokeLinejoin="round">
        <path
          d="M55 54h22v26H55l-7-5V59Z"
          fill="var(--surface)"
          stroke="currentColor"
          className="text-highlight"
        />
        <g className="text-highlight group-data-[playing=true]/scene:animate-couple">
          <path
            d="M67 47h32l10 9v22l-10 9H67Z"
            fill="var(--surface-raised)"
            stroke="currentColor"
          />
          <path
            d="M109 60h17v4h-17m0 6h17v4h-17M74 55v24m5-24v24"
            stroke="currentColor"
          />
        </g>
        <g className="text-primary">
          <path
            d="M136 49h34l12 10v16l-12 10h-34Z"
            fill="var(--surface-raised)"
            stroke="currentColor"
          />
          <path
            d="M136 56h8v22h-8m17-22v22m5-22v22m5-22v22"
            stroke="currentColor"
          />
        </g>
      </g>
      <circle
        cx="168"
        cy="43"
        r="3"
        fill="var(--accent)"
        className="group-data-[playing=true]/scene:animate-memory-light"
      />
    </>
  )
}

function Understand() {
  const wave =
    "M7 74 H39 Q46 74 51 62 T63 64 L73 84 L87 77 L99 40 L112 94 L126 61 L139 68 L150 48 L162 78 L174 74 H193 L200 64 L207 74 H244"
  return (
    <>
      <path
        d="M8 40h235M8 66h235M8 93h235"
        stroke="var(--border)"
        fill="none"
        strokeDasharray="2 5"
      />
      <path
        d={wave}
        stroke="var(--accent)"
        strokeWidth="1.7"
        fill="none"
        strokeLinejoin="round"
      />
      <g className="group-data-[playing=true]/scene:animate-observation-scan">
        <rect
          x="79"
          y="18"
          width="43"
          height="94"
          fill="url(#observation-sweep)"
        />
        <path d="M122 18v94" stroke="var(--accent)" strokeWidth="1.8" />
        <path d="m118 16 4 5 4-5" fill="var(--accent)" />
      </g>
      <defs>
        <linearGradient id="observation-sweep">
          <stop stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity=".24" />
        </linearGradient>
      </defs>
      {[
        { x: 99, y: 40 },
        { x: 150, y: 48 },
        { x: 200, y: 64 },
      ].map((p) => (
        <circle
          key={p.x}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="var(--surface)"
          stroke="var(--accent)"
        />
      ))}
    </>
  )
}

function ImproveMemory() {
  return (
    <g strokeLinejoin="round">
      {[3, 2, 1, 0].map((depth) => (
        <g key={depth} transform={`translate(0 ${depth * 9})`}>
          <g
            className={
              depth === 0
                ? "group-data-[playing=true]/scene:animate-memory-file"
                : undefined
            }
          >
            <path
              d="m63 58 75-36 54 27v5l-75 37-54-27Z"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeOpacity={depth ? ".36" : ".85"}
            />
            <path
              d="m63 58 75-36 54 27-75 37Z"
              fill="var(--accent)"
              fillOpacity={depth ? ".03" : ".13"}
              stroke="var(--accent)"
              strokeOpacity=".4"
            />
            {depth === 0 && (
              <g stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
                <path
                  d="m90 56 41-20m-32 24 29-14m-20 18 42-20"
                  opacity=".85"
                />
              </g>
            )}
          </g>
        </g>
      ))}
    </g>
  )
}

function VerifyChanges() {
  return (
    <>
      <SignalPath d="M108 66 H145 Q153 66 159 60 L168 51 Q173 47 180 47 H202" />
      {[32, 57, 82].map((y, i) => (
        <g
          key={y}
          className={
            i === 1
              ? "text-primary group-data-[playing=true]/scene:animate-retrieve"
              : "text-muted-foreground/45"
          }
        >
          <rect
            x="28"
            y={y}
            width="74"
            height="18"
            rx="4"
            fill="var(--surface)"
            stroke="currentColor"
          />
          <circle cx="39" cy={y + 9} r="2" fill="currentColor" />
          <path
            d={`M47 ${y + 9} h38`}
            stroke="currentColor"
            strokeLinecap="round"
          />
        </g>
      ))}
      <rect
        x="189"
        y="31"
        width="37"
        height="32"
        rx="6"
        fill="var(--surface-raised)"
        stroke="hsl(var(--highlight))"
      />
      <path
        d="m201 42-5 5 5 5m12-10 5 5-5 5"
        fill="none"
        stroke="hsl(var(--highlight))"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </>
  )
}

const illustrations = [
  Connect,
  Understand,
  ImproveMemory,
  VerifyChanges,
] as const

export function StepIllustration({ index }: { index: number }) {
  const Illustration = illustrations[index]
  return (
    <MotionScene className="mb-4 overflow-hidden rounded-xl border border-border bg-[radial-gradient(ellipse_at_50%_75%,var(--hero-glow),transparent_72%)]">
      <svg
        aria-hidden="true"
        viewBox="0 0 250 132"
        className="mx-auto block aspect-[250/132] w-full max-w-[18rem]"
      >
        <Illustration />
      </svg>
    </MotionScene>
  )
}
