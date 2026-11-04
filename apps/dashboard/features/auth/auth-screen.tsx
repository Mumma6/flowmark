"use client"

import {
  Alert,
  AlertDescription,
  Button,
  FlowmarkMark,
  Input,
} from "@flowmark/ui"
import { Result } from "effect"
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  GitBranch,
  Sparkle,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { publicConfig } from "../platform/config-public"
import { CopyButton } from "../shared/dashboard-components"
import { runBrowserAuth } from "./auth-browser-runtime"
import { authenticate } from "./operations"

export function AuthScreen({
  mode,
  localAccount,
}: {
  mode: "sign-in" | "sign-up"
  localAccount?: { readonly email: string; readonly password: string }
}) {
  const router = useRouter()
  const isSignUp = mode === "sign-up"
  const title = isSignUp ? "Create your workspace." : "Welcome to Studio."
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    const result = await runBrowserAuth(
      authenticate(mode, { name, email, password }),
    )
    Result.match(result, {
      onFailure: (failure) => setError(failure.reason),
      onSuccess: (href) => {
        router.push(href)
        router.refresh()
      },
    })
    setPending(false)
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <aside
        className="relative isolate hidden flex-col overflow-hidden border-r border-border bg-card/40 p-12 lg:flex xl:p-16"
        aria-label="About Flowmark Studio"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_0%_40%,hsl(var(--primary)/0.075),transparent_65%)]"
        />
        <a
          href="https://flowmark.dev"
          className="inline-flex w-fit items-center gap-2.5 text-xl font-semibold tracking-tight"
        >
          <FlowmarkMark className="size-8 text-primary" />
          flowmark<span className="-ml-2 text-primary">.</span>
        </a>
        <div className="my-auto max-w-lg py-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            Flowmark Studio
          </p>
          <p className="mt-6 text-[clamp(2.5rem,4.1vw,4.25rem)] font-medium leading-[1.06] tracking-[-0.05em]">
            The work happens
            <br />
            in your software.
            <br />
            <span className="text-muted-foreground">
              Understanding
              <br />
              happens here.
            </span>
          </p>
          <p className="mt-7 max-w-sm text-sm leading-7 text-muted-foreground">
            Follow your processes from application behavior to reported business
            outcomes. One shared context for your team and your agents.
          </p>
          <div className="mt-10 grid gap-0 border-y border-border">
            {[
              {
                icon: Braces,
                title: "Your application",
                detail: "Context, relationships and reported results",
              },
              {
                icon: GitBranch,
                title: "Connected evidence",
                detail: "Processes, executions and confirmations",
              },
              {
                icon: Sparkle,
                title: "Shared understanding",
                detail: "Studio, agents and the tools you build",
              },
            ].map(({ icon: Icon, title: itemTitle, detail }, index) => (
              <div
                key={itemTitle}
                className="flex items-center gap-4 border-b border-border py-5 last:border-0"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/5 text-primary">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-medium">{itemTitle}</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    {detail}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="ml-auto font-mono text-[9px] text-muted-foreground/60"
                >
                  0{index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Open-source process intelligence for people and agents.
        </p>
      </aside>

      <div className="flex min-h-screen flex-col px-6 py-7 sm:px-12 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <a
            href="https://flowmark.dev"
            aria-label="Flowmark home"
            className="flex items-center gap-2 text-sm font-semibold lg:hidden"
          >
            <FlowmarkMark className="size-6 text-primary" />
            flowmark<span className="-ml-2 text-primary">.</span>
          </a>
          <span className="hidden text-[11px] text-muted-foreground lg:inline">
            A workspace for understanding your application
          </span>
          <a
            href={publicConfig.documentationUrl}
            className="ml-auto inline-flex min-h-10 items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Documentation
            <ArrowUpRight aria-hidden="true" className="size-3" />
          </a>
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-12">
          <div className="mb-8">
            <span className="mb-6 inline-flex rounded border border-primary/20 bg-primary/5 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-primary">
              Flowmark Studio
            </span>
            <h1 className="text-3xl font-medium tracking-[-0.04em] sm:text-[34px]">
              {title}
            </h1>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {isSignUp
                ? "Create your account, then connect the application you want to understand."
                : "Sign in to explore your processes and pick up the evidence."}
            </p>
          </div>
          <form className="grid gap-5" onSubmit={onSubmit}>
            {error ? (
              <Alert role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {isSignUp ? (
              <label className="grid gap-2.5 text-xs">
                Name
                <Input
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 bg-card/50 text-sm"
                />
              </label>
            ) : null}
            <label className="grid gap-2.5 text-xs">
              Email
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="h-11 bg-card/50 text-sm"
              />
            </label>
            <div className="grid gap-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="studio-password">Password</label>
                {!isSignUp ? (
                  <Link
                    href="/forgot-password"
                    className="text-[11px] text-muted-foreground hover:text-primary"
                  >
                    Forgot password?
                  </Link>
                ) : null}
              </div>
              <Input
                id="studio-password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                className="h-11 bg-card/50 text-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={pending}
              className="mt-1 h-10 text-xs sm:h-9"
            >
              {pending
                ? "Please wait…"
                : isSignUp
                  ? "Create account"
                  : "Sign in to Studio"}
              <ArrowRight aria-hidden="true" className="ml-auto size-4" />
            </Button>
          </form>
          <nav
            aria-label="Account"
            className="mt-6 text-center text-xs text-muted-foreground"
          >
            {isSignUp ? "Already have an account? " : "New to Flowmark? "}
            <Link
              href={isSignUp ? "/sign-in" : "/sign-up"}
              className="text-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {isSignUp ? "Sign in" : "Create an account"}
            </Link>
          </nav>
          {localAccount ? (
            <details className="mt-8 rounded-lg border border-dashed border-border bg-card/30 px-4 py-3">
              <summary className="cursor-pointer text-[11px] text-muted-foreground">
                Local development account
              </summary>
              <div className="mt-4 grid gap-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code>{localAccount.email}</code>
                  <CopyButton value={localAccount.email} label="Copy email" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code>{localAccount.password}</code>
                  <CopyButton
                    value={localAccount.password}
                    label="Copy password"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={() => {
                    setEmail(localAccount.email)
                    setPassword(localAccount.password)
                  }}
                >
                  Fill local account
                </Button>
              </div>
            </details>
          ) : null}
        </div>
        <p className="text-center text-[10px] leading-6 text-muted-foreground">
          Your application owns the work. Flowmark makes it understandable.
        </p>
      </div>
    </main>
  )
}
