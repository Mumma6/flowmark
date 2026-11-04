"use client"

import {
  Button,
  FlowmarkMark,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  StudioChrome,
} from "@flowmark/ui"
import { Result } from "effect"
import {
  ArrowUpRight,
  BookOpen,
  CircleAlert,
  Code2,
  Compass,
  History,
  LayoutGrid,
  LineChart,
  LogOut,
  Settings,
  UserRound,
  Workflow,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { runBrowserAuth } from "../auth/auth-browser-runtime"
import { signOut } from "../auth/operations"
import { publicConfig } from "../platform/config-public"
import { RuntimeConfigProvider } from "../platform/runtime-config"
import { ProjectProvider } from "../projects/project-context"
import { ProjectSwitcher } from "../projects/project-switcher"
import { CommandPalette } from "../search/command-palette"
import { ThemeSelect } from "./theme-select"

const navigation = [
  { href: "/", label: "Explore", icon: Compass },
  { href: "/workflows", label: "Processes", icon: Workflow },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/issues", label: "Attention", icon: CircleAlert },
] as const

const utilities = [
  { href: "/runs", label: "Execution history", icon: History },
  { href: "/overview", label: "Project overview", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/onboarding?mode=guide", label: "Setup guide", icon: Code2 },
] as const

function AccountPanel({ email }: { email: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full border border-border bg-card"
            aria-label="Account and workspace"
          />
        }
      >
        <UserRound aria-hidden="true" className="size-4" />
      </SheetTrigger>
      <SheetContent className="left-auto right-0 w-80 gap-0 overflow-y-auto border-l border-r-0 p-6 pt-10">
        <SheetTitle className="flex items-center gap-2 text-base">
          <FlowmarkMark className="size-5 text-primary" />
          Flowmark Studio
        </SheetTitle>
        <SheetDescription className="mt-3 break-all text-xs leading-6">
          {email}
        </SheetDescription>
        <nav
          aria-label="Workspace navigation"
          className="my-7 grid gap-1 border-y border-border py-5"
        >
          {[...navigation, ...utilities].map(({ href, label, icon: Icon }) => (
            <Button
              key={href}
              asChild
              variant="ghost"
              className="h-9 justify-start text-xs text-muted-foreground"
            >
              <Link href={href} onClick={() => setOpen(false)}>
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </Button>
          ))}
          <Button
            asChild
            variant="ghost"
            className="h-9 justify-start text-xs text-muted-foreground"
          >
            <a href={publicConfig.documentationUrl}>
              <BookOpen aria-hidden="true" className="size-4" />
              Documentation
              <ArrowUpRight aria-hidden="true" className="ml-auto size-3.5" />
            </a>
          </Button>
        </nav>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Appearance</span>
          <ThemeSelect />
        </div>
        <Button
          variant="outline"
          disabled={pending}
          className="mt-8 h-9 justify-start text-xs"
          onClick={async () => {
            setError(null)
            setPending(true)
            Result.match(await runBrowserAuth(signOut()), {
              onFailure: (failure) => setError(failure.reason),
              onSuccess: () => {
                router.push("/sign-in")
                router.refresh()
              },
            })
            setPending(false)
          }}
        >
          <LogOut aria-hidden="true" className="size-4" />
          {pending ? "Signing out…" : "Sign out"}
        </Button>
        {error ? (
          <p role="alert" className="mt-3 text-xs leading-6 text-destructive">
            {error}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export function StudioShell({
  children,
  email,
  apiOrigin,
}: {
  children: ReactNode
  email: string
  apiOrigin: string
}) {
  const pathname = usePathname()
  return (
    <RuntimeConfigProvider apiOrigin={apiOrigin}>
      <ProjectProvider>
        <div className="relative isolate min-h-screen overflow-x-clip bg-background">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.04),transparent_65%)]"
          />
          <a
            href="#studio-main"
            className="sr-only z-[100] rounded-md bg-card px-4 py-3 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:ring-2 focus:ring-ring"
          >
            Skip to content
          </a>
          <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
            <StudioChrome
              brand={
                <Link
                  href="/"
                  aria-label="Flowmark Studio home"
                  className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight"
                >
                  <FlowmarkMark className="size-7 text-primary" />
                  <span className="hidden sm:inline">
                    flowmark<span className="text-primary">.</span>
                  </span>
                  <span className="ml-1 hidden rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium tracking-normal text-primary lg:inline">
                    Studio
                  </span>
                </Link>
              }
              project={<ProjectSwitcher />}
              search={<CommandPalette />}
              account={<AccountPanel email={email} />}
              navigation={
                <nav
                  aria-label="Main navigation"
                  className="flex min-w-0 gap-1 overflow-x-auto"
                >
                  {navigation.map(({ href, label, icon: Icon }) => {
                    const active =
                      href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex min-h-10 shrink-0 items-center gap-2 px-2.5 text-[11px] transition-colors sm:px-4 sm:text-xs ${active ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Icon
                          aria-hidden="true"
                          className={`hidden size-3.5 sm:block ${active ? "text-primary" : ""}`}
                        />
                        {label}
                      </Link>
                    )
                  })}
                </nav>
              }
              utility={
                <Link
                  href="/runs"
                  className="hidden items-center gap-2 px-2 py-3 text-[11px] text-muted-foreground hover:text-foreground md:flex"
                >
                  <History aria-hidden="true" className="size-3.5" />
                  Execution history
                  <ArrowUpRight aria-hidden="true" className="size-3" />
                </Link>
              }
            />
          </header>
          <main
            id="studio-main"
            tabIndex={-1}
            className="mx-auto min-w-0 w-full max-w-[1680px] px-4 py-8 sm:px-8 sm:py-10"
          >
            {children}
          </main>
        </div>
      </ProjectProvider>
    </RuntimeConfigProvider>
  )
}
