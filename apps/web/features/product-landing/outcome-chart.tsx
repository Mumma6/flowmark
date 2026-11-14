import { chartPoints, comparison } from "./process-data"

export function OutcomeChart() {
  return (
    <figure aria-label="Booking confirmations across comparable seven-day cohorts">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Confirmed within 20 minutes
          </p>
          <p className="mt-2 flex items-baseline gap-3">
            <span className="text-5xl font-medium tracking-[-0.06em] tabular-nums">
              76<span className="text-3xl text-muted-foreground">%</span>
            </span>
            <span className="rounded-full bg-warning/10 px-2.5 py-1 font-mono text-[10px] text-warning">
              −16 pp
            </span>
          </p>
        </div>
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="w-4 border-t border-dashed border-highlight" />
            Previous
          </span>
          <span className="flex items-center gap-2">
            <span className="h-px w-4 bg-primary" />
            Current
          </span>
        </div>
      </div>
      <svg
        viewBox="0 0 600 190"
        className="mt-5 w-full overflow-visible"
        role="img"
        aria-label="Current confirmations decline from 90% to 64%; the previous period stays around 92%."
      >
        {[30, 75, 120, 165].map((y) => (
          <line
            key={y}
            x1="30"
            x2="570"
            y1={y}
            y2={y}
            className="stroke-border"
            strokeDasharray="2 5"
          />
        ))}
        <text
          x="0"
          y="33"
          className="fill-muted-foreground font-mono text-[9px]"
        >
          100
        </text>
        <text
          x="6"
          y="123"
          className="fill-muted-foreground font-mono text-[9px]"
        >
          40
        </text>
        <polygon
          points={`30,165 ${chartPoints(comparison.current)} 570,165`}
          className="fill-primary/[0.045]"
        />
        <polyline
          points={chartPoints(comparison.baseline)}
          fill="none"
          className="stroke-highlight/60"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
        <polyline
          points={chartPoints(comparison.current)}
          fill="none"
          className="stroke-primary motion-safe:animate-trace"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength="1"
        />
        {comparison.current.map((value, index) => (
          <circle
            key={index}
            cx={30 + index * 90}
            cy={180 - value * 1.5}
            r="3"
            className="fill-card stroke-primary"
            strokeWidth="2"
          />
        ))}
        <text
          x="30"
          y="187"
          className="fill-muted-foreground font-mono text-[9px]"
        >
          DAY 1
        </text>
        <text
          x="545"
          y="187"
          className="fill-muted-foreground font-mono text-[9px]"
        >
          DAY 7
        </text>
      </svg>
      <figcaption className="mt-3 text-[10px] leading-5 text-muted-foreground">
        532 of 700 eligible bookings · 17–24 Oct vs 10–17 Oct 2026
      </figcaption>
      <details className="mt-2 text-[10px] text-muted-foreground">
        <summary className="w-fit cursor-pointer py-1 hover:text-foreground">
          Chart data &amp; comparison scope
        </summary>
        <div className="mt-2 overflow-x-auto rounded-lg border border-border p-3">
          <table className="w-full text-left tabular-nums">
            <caption className="mb-2 text-left">
              Daily confirmation rates · 100 eligible bookings per day
            </caption>
            <thead>
              <tr>
                <th className="py-1 font-medium">Cohort</th>
                {comparison.current.map((_, i) => (
                  <th key={i} className="px-2 font-normal">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="py-1 font-normal">Previous</th>
                {comparison.baseline.map((v, i) => (
                  <td key={i} className="px-2">
                    {v}%
                  </td>
                ))}
              </tr>
              <tr>
                <th className="py-1 font-normal">Current</th>
                {comparison.current.map((v, i) => (
                  <td key={i} className="px-2">
                    {v}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-3 leading-5">
            Consecutive seven-day start cohorts, bounded at 10:30 UTC. All
            20-minute expectation windows have elapsed at observation. Same
            definition revision 3; required-field coverage 700/700 in each
            cohort. Synthetic observations describe a change, not its cause.
          </p>
        </div>
      </details>
    </figure>
  )
}
