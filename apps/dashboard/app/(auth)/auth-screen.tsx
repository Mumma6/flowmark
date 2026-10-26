"use client"

import { useState } from "react"
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@flowmark/ui"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "../../lib/auth-client"

export function AuthScreen({
  mode,
}: {
  mode: "sign-in" | "sign-up"
}) {
  const router = useRouter()
  const isSignUp = mode === "sign-up"
  const title = isSignUp ? "Create an account" : "Sign in"
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (isSignUp) {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        })
        const body = (await response.json()) as {
          ok?: boolean
          error?: string
        }
        if (!response.ok) {
          throw new Error(body.error ?? "Could not create the account.")
        }
      }
      const result = await authClient.signIn.email({ email, password })
      if (result.error) {
        throw new Error(result.error.message ?? "Could not sign in.")
      }
      router.push(isSignUp ? "/settings?section=projects" : "/")
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not complete sign-in.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {isSignUp
              ? "Create an account, then add a project in Settings when you are ready to ingest runs."
              : "Email and password for the Flowmark dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            {error ? (
              <Alert>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {isSignUp && (
              <label className="grid gap-2 text-sm">
                Name
                <Input
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            <label className="grid gap-2 text-sm">
              Email
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm">
              Password
              <Input
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "Please wait…" : title}
            </Button>
          </form>
          <nav
            className="mt-5 flex flex-wrap gap-4 text-sm text-primary"
            aria-label="Account"
          >
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">Create account</Link>
          </nav>
          <Button asChild variant="ghost" className="mt-6">
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              Back to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
