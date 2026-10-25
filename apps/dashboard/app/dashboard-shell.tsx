"use client"

import { useState, type ReactNode } from "react"
import {
  BookOpen,
  GitBranch,
  LayoutDashboard,
  Menu,
  Settings,
  Workflow,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  FlowmarkMark,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@flowmark/ui"
import { ThemeSelect } from "./theme-select"

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/runs", label: "Runs", icon: GitBranch },
  { href: "/settings", label: "Settings", icon: Settings },
]
const docsUrl =
  process.env.NEXT_PUBLIC_FLOWMARK_DOCS_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3002/docs/introduction"
    : "/docs/introduction")

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2.5 text-xl tracking-tight text-foreground"
        onClick={onNavigate}
      >
        <FlowmarkMark className="shrink-0 text-primary" />
        <strong>
          flowmark<span className="text-primary">.</span>
        </strong>
      </Link>
      <Badge variant="secondary" className="self-start">
        Local development project
      </Badge>
      <Separator className="my-5" />
      <nav aria-label="Main navigation" className="grid gap-1">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === href : pathname.startsWith(href)
          return (
            <Button
              key={href}
              asChild
              variant={active ? "secondary" : "ghost"}
              className={
                active ? "justify-start text-primary" : "justify-start"
              }
            >
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                {label}
              </Link>
            </Button>
          )
        })}
      </nav>
      <div className="mt-auto">
        <Separator className="mb-4" />
        <Button asChild variant="ghost" className="w-full justify-start">
          <a href={docsUrl}>
            <BookOpen aria-hidden="true" />
            Documentation
          </a>
        </Button>
        <p className="mx-2 mt-3 text-xs leading-6 text-muted-foreground">
          Fixed development account. No production authentication.
        </p>
      </div>
    </div>
  )
}

function PageBreadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const section = navigation.find((item) => item.href === `/${segments[0]}`)
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {segments.length ? (
            <BreadcrumbLink asChild>
              <Link href="/">Project</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Overview</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {section && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {segments.length > 1 ? (
                <BreadcrumbLink asChild>
                  <Link href={section.href}>{section.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{section.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}
        {segments[1] && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {segments[0] === "runs"
                  ? "Run details"
                  : decodeURIComponent(segments[1])}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen">
      <a
        href="#dashboard-main"
        className="sr-only z-[100] rounded-md bg-card px-4 py-3 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 border-r border-border bg-card px-4 py-6 lg:block">
        <Navigation />
      </aside>
      <div className="min-w-0 lg:ml-56">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 lg:hidden"
                  />
                }
                aria-label="Open navigation"
              >
                <Menu aria-hidden="true" />
              </SheetTrigger>
              <SheetContent>
                <SheetTitle className="sr-only">Project navigation</SheetTitle>
                <SheetDescription className="sr-only">
                  Browse workflows, runs and project settings.
                </SheetDescription>
                <Navigation onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <PageBreadcrumbs />
          </div>
          <ThemeSelect />
        </header>
        <main
          id="dashboard-main"
          className="mx-auto w-full max-w-[1600px] p-4 sm:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
