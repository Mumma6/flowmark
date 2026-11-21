import { BrandLink } from "./brand"
import { shellClassName } from "./shell"
import { docsUrl, githubUrl } from "./site-links"

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div
        className={`${shellClassName} flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-7`}
      >
        <BrandLink />
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-5 text-xs text-muted-foreground"
        >
          <a className="py-2 hover:text-primary" href={docsUrl}>
            Documentation
          </a>
          <a className="py-2 hover:text-primary" href={githubUrl}>
            GitHub
          </a>
          <a className="py-2 hover:text-primary" href="#main">
            Back to top ↑
          </a>
        </nav>
      </div>
    </footer>
  )
}
