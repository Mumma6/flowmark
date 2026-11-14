import { Button } from "@flowmark/ui"
import { Arrow, BrandLink } from "./brand"
import { MobileNavigation } from "./mobile-navigation"
import { shellClassName } from "./shell"
import { docsUrl } from "./site-links"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div
        className={`${shellClassName} flex min-h-[72px] items-center justify-between gap-3`}
      >
        <BrandLink />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 text-xs text-muted-foreground md:flex"
        >
          {[
            { label: "Platform", href: "#experience" },
            { label: "Discover", href: "#discover" },
            { label: "Evolve", href: "#evolve" },
            { label: "Docs", href: docsUrl },
          ].map((item) => (
            <a
              key={item.label}
              className="py-3 transition-colors hover:text-foreground"
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            asChild
            variant="outline"
            className="h-10 border-primary/25 bg-primary/5 px-3 text-[11px] text-primary sm:px-4"
          >
            <a href="#waitlist">
              Join the Waitlist{" "}
              <span className="hidden sm:block">
                <Arrow />
              </span>
            </a>
          </Button>
          <MobileNavigation />
        </div>
      </div>
    </header>
  )
}
