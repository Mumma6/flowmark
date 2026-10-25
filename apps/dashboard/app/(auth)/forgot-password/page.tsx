import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import Link from "next/link"

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Flowmark development workspace</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Alert>
            <AlertDescription>
              Password reset is not available yet. It needs email delivery,
              which this increment does not include. Sign in with your existing
              password or create a new account.
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
