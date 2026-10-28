"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  BookOpen,
  GitBranch,
  LayoutDashboard,
  Menu,
  Settings,
  Workflow,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { authClient } from "../lib/auth-client"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  FlowmarkMark,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@flowmark/ui"
import { ProjectProvider, useProject } from "./project-context"
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
    : "https://docs.flowmark.dev/docs/introduction")

function SignOutButton() {
  const router = useRouter()
  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start"
      onClick={async () => {
        await authClient.signOut()
        router.push("/sign-in")
        router.refresh()
      }}
    >
      Sign out
    </Button>
  )
}

function Navigation({
  email,
  onNavigate,
}: {
  email: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2.5 text-xl tracking-tight text-foreground"
        onClick={onNavigate}
      >
        <FlowmarkMark className="shrink-0 text-primary" />
        <strong>
          flowmark<span className="text-primary">.</span>
        </strong>
      </Link>
      <ProjectSwitcher />
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
                active
                  ? "justify-start border border-primary/20 bg-primary/10 text-primary shadow-sm"
                  : "justify-start text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
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
          Signed in as {email}
        </p>
        <SignOutButton />
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

function ProjectSwitcher() {
  const { projects, current, pending, select } = useProject()
  const items = useMemo(
    () =>
      Object.fromEntries(projects.map((project) => [project.id, project.name])),
    [projects],
  )
  if (pending && projects.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" role="status">
        Loading projects…
      </p>
    )
  }
  if (projects.length === 0) {
    return (
      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">No project yet</p>
        <Button asChild size="sm" variant="outline" className="justify-start">
          <Link href="/settings?section=projects">Create a project</Link>
        </Button>
      </div>
    )
  }
  if (projects.length === 1) {
    return (
      <p className="truncate text-sm font-medium text-foreground">
        {current?.name ?? projects[0]?.name}
      </p>
    )
  }
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor="project-switcher"
        className="text-xs text-muted-foreground"
      >
        Project
      </label>
      <Select
        items={items}
        value={current?.id ?? projects[0]?.id}
        onValueChange={select}
      >
        <SelectTrigger id="project-switcher">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function DashboardShell({
  children,
  email,
}: {
  children: ReactNode
  email: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <ProjectProvider>
      <div className="min-h-screen bg-background">
        <a
          href="#dashboard-main"
          className="sr-only z-[100] rounded-md bg-card px-4 py-3 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 border-r border-border bg-card px-4 py-6 lg:block">
          <Navigation email={email} />
        </aside>
        <div className="min-w-0 lg:ml-56">
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur sm:px-8">
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
                  <SheetTitle className="sr-only">
                    Project navigation
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Browse workflows, runs and project settings.
                  </SheetDescription>
                  <Navigation email={email} onNavigate={() => setOpen(false)} />
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
            <h1>Preview test 6</h1>
            {children}
          </main>
        </div>
      </div>
    </ProjectProvider>
  )
}
