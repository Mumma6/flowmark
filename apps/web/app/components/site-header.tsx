import { Button } from "@flowmark/ui"
import { Arrow, BrandLink } from "./brand"
import { shellClassName } from "./shell"
import { appUrl, docsUrl, githubUrl } from "./site-links"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div
        className={`${shellClassName} flex min-h-16 items-center justify-between gap-6 sm:min-h-[4.5rem]`}
      >
        <BrandLink />
        <nav
          className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] text-muted-foreground sm:gap-4"
          aria-label="Main navigation"
        >
          <a className="hidden hover:text-primary sm:inline" href="#product">
            Product
          </a>
          <a
            className="hidden hover:text-primary sm:inline"
            href="#how-it-works"
          >
            How it works
          </a>
          <a className="hidden hover:text-primary lg:inline" href="#faq">
            FAQ
          </a>
          <Button asChild variant="ghost" size="sm">
            <a href={githubUrl}>GitHub</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={docsUrl}>Docs</a>
          </Button>
          <Button asChild size="sm">
            <a href={appUrl}>
              Dashboard <Arrow />
            </a>
          </Button>
        </nav>
      </div>
    </header>
  )
}
