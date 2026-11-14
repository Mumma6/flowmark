import { Separator } from "@flowmark/ui"
import { BrandLink } from "./brand"
import { shellClassName } from "./shell"
import { docsUrl, githubUrl } from "./site-links"

const columns = [
  {
    title: "Product",
    links: [
      { href: "#studio", label: "Explore the platform" },
      { href: "#discover", label: "Discovery & instrumentation" },
      { href: "#evolve", label: "Continuous evolution" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "#waitlist", label: "Join the Waitlist" },
      { href: docsUrl, label: "Documentation" },
      { href: githubUrl, label: "GitHub" },
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div
        className={`${shellClassName} grid gap-10 py-12 sm:grid-cols-[1.2fr_1fr] lg:grid-cols-[1.4fr_1fr_1fr]`}
      >
        <div>
          <BrandLink />
          <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
            Process intelligence for people and agents. Open source under MIT.
          </p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="text-xs font-medium tracking-wide text-foreground">
              {column.title}
            </p>
            <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a
                    className="transition-colors hover:text-highlight"
                    href={link.href}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <Separator />
      <div
        className={`${shellClassName} flex flex-col gap-2 py-5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between`}
      >
        <p>© 2026 Flowmark</p>
        <p>Understand what your software actually does.</p>
      </div>
    </footer>
  )
}
