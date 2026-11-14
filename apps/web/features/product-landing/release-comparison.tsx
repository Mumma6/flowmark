import { Button } from "@flowmark/ui"

export function ReleaseComparison({ onJourney }: { onJourney: () => void }) {
  return (
    <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-highlight">
          Release-associated change
        </p>
        <h3 className="mt-4 text-2xl font-medium tracking-tight">
          Same completion. Different outcome.
        </h3>
        <div className="mt-7 overflow-x-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <caption className="sr-only">
              Synthetic comparison of two release cohorts, 700 eligible bookings
              each.
            </caption>
            <thead className="text-[10px] text-muted-foreground">
              <tr>
                <th className="pb-4 font-normal">Reported measure</th>
                <th className="px-3 pb-4 font-normal">
                  Previous
                  <br />
                  <span className="font-mono">2026.10.10</span>
                </th>
                <th className="pb-4 font-normal">
                  Current
                  <br />
                  <span className="font-mono">2026.10.17</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th className="py-4 font-normal">Execution completed</th>
                <td className="px-3 text-success">99.3%</td>
                <td className="text-success">99.3%</td>
              </tr>
              <tr className="border-t border-border">
                <th className="py-4 font-normal">Confirmed within 20m</th>
                <td className="px-3">92%</td>
                <td className="text-warning">
                  76% <span className="ml-1 text-[10px]">−16 pp</span>
                </td>
              </tr>
              <tr className="border-t border-border">
                <th className="py-4 font-normal">Required-field coverage</th>
                <td className="px-3">100%</td>
                <td>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
          700 eligible bookings per cohort · definition revision 3<br />
          10–17 Oct vs 17–24 Oct 2026 · windows bounded at 10:30 UTC
        </p>
      </div>
      <aside className="rounded-xl border border-warning/20 bg-warning/[0.035] p-5 sm:p-6">
        <p className="text-xs text-warning">What the evidence says</p>
        <p className="mt-5 text-lg leading-7 tracking-tight">
          Confirmations fell while execution completion stayed stable.
        </p>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          Both cohorts have elapsed confirmation windows and consistent field
          coverage. The change coincides with a release; its cause still needs
          investigation.
        </p>
        <Button
          onClick={onJourney}
          variant="outline"
          className="mt-5 h-10 text-xs"
        >
          Follow a journey <span aria-hidden="true">→</span>
        </Button>
      </aside>
    </div>
  )
}
