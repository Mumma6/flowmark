import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@flowmark/ui"
import Link from "next/link"

const apiUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3003"
    : "https://api.flowmark.dev"

export function EmptyProject() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No runs yet</CardTitle>
        <CardDescription>
          Create a write key, put it in your app, and mark a process. Runs
          show up here as soon as the API receives them.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6">
          {`npm i @flowmarkdev/node@alpha

FLOWMARK_API_KEY=<write-key-from-settings>
FLOWMARK_API_URL=${apiUrl}

import { createFlowmark } from "@flowmarkdev/node"

export const flowmark = createFlowmark()`}
        </pre>
        <Button asChild className="justify-self-start">
          <Link href="/settings">Open settings</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
