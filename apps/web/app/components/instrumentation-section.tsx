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
      className="border-t border-border bg-secondary/15 py-16 sm:py-24"
      aria-labelledby="how-title"
    >
      <div className={shellClassName}>
        <div className="mb-9 grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-16">
          <div>
            <p className={overlineClassName}>
              Small write API. A richer read experience.
            </p>
            <h2 id="how-title" className={`${sectionTitleClassName} mt-4`}>
              Your code, with a few
              <br className="hidden sm:block" /> well-placed markers.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-muted-foreground">
            Use ordinary TypeScript and Promises. Name the workflow, mark what
            matters, and attach a result. Your function keeps its return value
            and its original errors.
          </p>
        </div>
        <CodeShowcase />
        <div className="mt-8 grid gap-5 border-t border-border pt-6 sm:grid-cols-3">
          {[
            {
              n: "01",
              title: "Create your project",
              detail: "Open the dashboard and create a server-write key.",
            },
            {
              n: "02",
              title: "Configure the SDK",
              detail: "Set your API URL and server key. Add one shared client.",
            },
            {
              n: "03",
              title: "Run your code normally",
              detail:
                "Report a result, drain delivery, and open the recorded run.",
            },
          ].map((item) => (
            <div key={item.n}>
              <p className="text-sm font-medium">
                <span className="mr-2 font-mono text-[10px] text-primary">
                  {item.n}
                </span>
                {item.title}
              </p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-background px-5 py-4">
          <code className="text-xs sm:text-sm">
            <span className="mr-3 text-muted-foreground" aria-hidden="true">
              $
            </span>
            npm i @flowmarkdev/node
          </code>
          <Button asChild variant="link" className="h-auto p-0 text-xs">
            <a href={docsUrl}>
              Follow the quickstart <Arrow />
            </a>
          </Button>
        </div>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          Examples assume a configured client; application helpers are your own
          code. Node.js workers drain delivery with flush() or shutdown().
          Next.js has a request-lifecycle adapter.
        </p>
      </div>
    </section>
  )
}
