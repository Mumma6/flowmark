import { Button } from "@flowmark/ui"
import { Arrow, Mark } from "./brand"
import { docsUrl } from "./site-links"

export function ClosingSection() {
  return (
    <section className="closing-section" aria-labelledby="closing-title">
      <div className="shell closing-inner">
        <div className="closing-mark">
          <Mark />
        </div>
        <p className="overline">START WITH ONE WORKFLOW</p>
        <h2 id="closing-title">
          Start with one process you need answers about.
        </h2>
        <p>
          An import, a sync, an order. Add a few markers and report what it
          accomplished.
        </p>
        <Button asChild className="button button-primary" size="lg">
          <a href={docsUrl}>
            Read the introduction <Arrow />
          </a>
        </Button>
      </div>
    </section>
  )
}
