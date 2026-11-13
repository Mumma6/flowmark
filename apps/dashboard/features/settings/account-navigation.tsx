import Link from "next/link"
import { ThemeSelect } from "../shell/theme-select"

const destinations = [
  { id: "account", href: "/account", label: "Account" },
  { id: "security", href: "/account/security", label: "Security" },
  { id: "privacy", href: "/data-privacy", label: "Data & privacy" },
  { id: "help", href: "/account/help", label: "Setup help" },
] as const

export function AccountNavigation({
  current,
}: {
  readonly current: (typeof destinations)[number]["id"]
}) {
  return (
    <div className="grid gap-4 border-b border-border pb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="text-sm text-primary underline underline-offset-4"
        >
          Back to Studio
        </Link>
        <ThemeSelect />
      </div>
      <nav
        aria-label="Account settings"
        className="flex flex-wrap gap-x-5 gap-y-3 text-sm"
      >
        {destinations.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={current === item.id ? "page" : undefined}
            className={
              current === item.id
                ? "font-semibold text-foreground underline underline-offset-4"
                : "text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
