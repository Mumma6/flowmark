import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@flowmark/ui"
import { PageHeading } from "../../dashboard-components"

export default function SettingsPage() {
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title="Project settings"
        description="Configuration boundaries for this development workspace."
      />
      <Card>
        <CardHeader>
          <CardTitle>Local development project</CardTitle>
          <CardDescription>
            Fixed account and project for contributor testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Instrumented server applications send events with{" "}
            <code>FLOWMARK_API_KEY</code>. The dashboard reads project-scoped
            data using a separate server-held read key.
          </p>
          <Separator />
          <p>
            The development harness is local-only. It is not a public demo,
            customer application, or deployment target.
          </p>
          <Alert>
            <AlertDescription>
              Production login, registration and API key management are not
              implemented. Do not expose this development workspace publicly.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
