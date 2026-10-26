import { Separator } from "@flowmark/ui"
import { BrandLink } from "./brand"
import { shellClassName } from "./shell"
import { appUrl, docsUrl, githubUrl } from "./site-links"

const columns = [
  {
    title: "Product",
    links: [
      { href: "#product", label: "Product" },
      { href: "#how-it-works", label: "How it works" },
      { href: "#capabilities", label: "Capabilities" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: appUrl, label: "Dashboard" },
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
            Workflow observability for application code. Open source under MIT.
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
                  <a className="hover:text-primary" href={link.href}>
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
        <p>Understand every execution. Discover what matters across them.</p>
      </div>
    </footer>
  )
}
