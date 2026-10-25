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

export function AuthScreen({
  mode,
}: {
  mode: "sign-in" | "sign-up" | "forgot-password"
}) {
  const isSignUp = mode === "sign-up"
  const isReset = mode === "forgot-password"
  const title = isSignUp
    ? "Create an account"
    : isReset
      ? "Reset password"
      : "Sign in"
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Flowmark development workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Production authentication is not implemented. These account forms
              are previews only and cannot submit credentials. The local
              dashboard uses a fixed development account.
            </AlertDescription>
          </Alert>
          <fieldset
            disabled
            className="mt-6 grid gap-4"
            aria-label={`${title} preview`}
          >
            {isSignUp && (
              <label className="grid gap-2 text-sm">
                Name
                <Input autoComplete="name" placeholder="Your name" />
              </label>
            )}
            <label className="grid gap-2 text-sm">
              Email
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            {!isReset && (
              <label className="grid gap-2 text-sm">
                Password
                <Input
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
              </label>
            )}
            <Button type="button" disabled>
              {isReset ? "Send reset instructions" : title}
            </Button>
          </fieldset>
          <nav
            className="mt-5 flex flex-wrap gap-4 text-sm text-primary"
            aria-label="Account previews"
          >
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">Create account</Link>
            <Link href="/forgot-password">Reset password</Link>
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
