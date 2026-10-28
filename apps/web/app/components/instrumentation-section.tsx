import { Button } from "@flowmark/ui"
import { Arrow } from "./brand"
import { CodeShowcase } from "./code-showcase"
import {
  overlineClassName,
  sectionTitleClassName,
  shellClassName,
} from "./shell"
import { docsUrl } from "./site-links"

export function InstrumentationSection() {
  return (
    <section
      id="how-it-works"
      className="border-y border-border bg-[#0d1112] bg-[radial-gradient(ellipse_at_16%_0%,#b9f59705,transparent_55%)] py-16 sm:py-[6.25rem]"
      aria-labelledby="how-title"
    >
      <div className={shellClassName}>
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:mb-10 sm:flex-row sm:items-end sm:gap-8">
          <div>
            <p className={overlineClassName}>
              A little code. A clearer account.
            </p>
            <h2 id="how-title" className={`${sectionTitleClassName} mt-4`}>
              Keep the logic. See the execution.
            </h2>
          </div>
          <p className="max-w-md text-[13px] leading-7 text-muted-foreground">
            Developers mark existing TypeScript with a small write API. The same
            evidence opens one execution and, over time, what changed across
            them. Flowmark does not run, schedule, or retry the work.
          </p>
        </div>
        <CodeShowcase />
        <p className="mt-5 border-t border-border pt-5 text-xs leading-7 text-muted-foreground">
          Install with{" "}
          <code className="font-mono text-[0.92em]">
            npm i @flowmarkdev/node
          </code>
          , then one shared server client:{" "}
          <code className="font-mono text-[0.92em]">
            const flowmark = createFlowmark()
          </code>
          . Business helpers belong to your app.{" "}
          <Button asChild variant="link" className="h-auto p-0 text-xs">
            <a href={docsUrl}>
              SDK setup and framework guides <Arrow diagonal />
            </a>
          </Button>
        </p>
      </div>
    </section>
  )
}
