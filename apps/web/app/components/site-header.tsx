import { Button } from "@flowmark/ui"
import { MotionToggle } from "../../features/product-landing/motion"
import { Arrow, BrandLink } from "./brand"
import { MobileNavigation } from "./mobile-navigation"
import { shellClassName } from "./shell"
import { navigation } from "./site-links"

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
          {navigation.map((item) => (
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
          <MotionToggle />
          <Button
            asChild
            variant="outline"
            className="hidden h-10 border-primary/25 bg-primary/5 px-3 text-[11px] text-primary min-[400px]:inline-flex sm:px-4"
          >
            <a href="#waitlist">
              Join the waitlist{" "}
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
