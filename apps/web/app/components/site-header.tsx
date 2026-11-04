import { Button } from "@flowmark/ui"
import { Arrow, BrandLink } from "./brand"
import { MobileNavigation } from "./mobile-navigation"
import { shellClassName } from "./shell"
import { appUrl, docsUrl, githubUrl } from "./site-links"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
      <div
        className={`${shellClassName} flex min-h-[72px] items-center justify-between gap-3`}
      >
        <BrandLink />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 text-[13px] text-muted-foreground md:flex"
        >
          <a
            className="py-3 transition-colors hover:text-foreground"
            href="#studio"
          >
            Studio
          </a>
          <a
            className="py-3 transition-colors hover:text-foreground"
            href="#platform"
          >
            Platform
          </a>
          <a
            className="py-3 transition-colors hover:text-foreground"
            href="#everywhere"
          >
            Everywhere
          </a>
          <a
            className="py-3 transition-colors hover:text-foreground"
            href={docsUrl}
          >
            Docs
          </a>
          <a
            className="py-3 transition-colors hover:text-foreground"
            href={githubUrl}
          >
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="hidden h-10 px-3 text-xs min-[360px]:inline-flex sm:px-4"
          >
            <a href={appUrl}>
              Open Studio <Arrow />
            </a>
          </Button>
          <MobileNavigation />
        </div>
      </div>
    </header>
  )
}
