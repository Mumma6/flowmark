import Link from "next/link"
import { Option } from "effect"
import { redirect } from "next/navigation"
import { Button, Card, CardHeader, CardTitle, CardContent } from "@flowmark/ui"
import { getDashboardSession } from "../../../features/platform/server-runtime"
import { publicConfig } from "../../../features/platform/config-public"
import { AccountNavigation } from "../../../features/settings/account-navigation"

export const dynamic = "force-dynamic"

/** Account help requires sign-in, never a project or completed SDK setup. */
export default async function AccountHelpPage() {
  if (Option.isNone(await getDashboardSession())) {
    redirect("/sign-in")
  }
  return (
    <main className="mx-auto grid w-full max-w-3xl min-w-0 gap-6 px-4 py-8">
      <AccountNavigation current="help" />
      <h1 className="text-2xl font-semibold">Setup help</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        You can manage your account before creating a project. Flowmark observes
        work your application runs; connecting it does not execute or retry that
        work.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Start or resume application setup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-6">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Create a project for the application you want to observe.</li>
            <li>
              Create a project write key and keep server keys on the server.
              Browser ingestion keys require allowed origins and never grant
              read access.
            </li>
            <li>Install the SDK and instrument a workflow and its runs.</li>
            <li>
              Send a synthetic run from your application, then check the
              reported evidence in Studio.
            </li>
          </ol>
          <p className="text-muted-foreground">
            The setup guide resumes unfinished onboarding. Once setup is
            complete, you can revisit it without resetting progress.
          </p>
          <div>
            <Button asChild>
              <Link href="/onboarding?mode=guide">Open setup guide</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Find the right access controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-6">
          <p>
            Your email and password sign you in. Project API keys send or read
            evidence for one project. Delegated agent connections are managed
            separately through Connect.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/account/security" className="text-primary underline">
              Password and browser sessions
            </Link>
            <Link href="/connect" className="text-primary underline">
              Connect an agent
            </Link>
            <a
              href={publicConfig.documentationUrl}
              className="text-primary underline"
            >
              SDK documentation
            </a>
          </div>
          <p className="text-muted-foreground">
            Connect and project settings may send you back to unfinished setup.
            Account, Security and Data &amp; privacy remain available here.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
