"use client"

import { Alert, AlertDescription, AlertTitle, Button } from "@flowmark/ui"
import { Match } from "effect"
import { useRouter } from "next/navigation"
import { CopyButton } from "../../shared/dashboard-components"
import { useAgentAccess } from "../access/use-agent-access"
import { useAgentReadVerification } from "../access/use-agent-read-verification"
import type { AgentReadVerification } from "../access/agent-access-verification"
import { cursorConnectionPrompt } from "../access/agent-access-guidance"
import {
  cursorMcpConfig,
  cursorMcpRedirectUris,
} from "../access/cursor-mcp-client"

const verificationCopy = (verification: AgentReadVerification): string =>
  Match.value(verification).pipe(
    Match.tag(
      "Authenticated",
      () =>
        "Connection authenticated. Run the check in Cursor below to verify this project's read access.",
    ),
    Match.tag(
      "Granted",
      () =>
        "Project access approved. Return to Cursor and run the connection check below.",
    ),
    Match.tag(
      "WrongProject",
      () =>
        "No connection for this project yet. Sign in from Cursor and approve this project.",
    ),
    Match.tag(
      "Denied",
      () =>
        "Sign in to Studio again with the account you used in Cursor, then retry.",
    ),
    Match.tag(
      "Unavailable",
      () =>
        "Connection status is unavailable. Retry, or check the tool results in Cursor.",
    ),
    Match.tag(
      "CopyFailed",
      () => "Copy failed. Select the configuration text and copy it manually.",
    ),
    Match.tag(
      "Copied",
      () =>
        "Configuration copied. Save it in Cursor, then sign in to Flowmark.",
    ),
    Match.orElse(
      () => "After signing in from Cursor, run the connection check below.",
    ),
  )

/** MCP read access in Connect; independent of SDK installation. */
export function CursorConnectionSetup() {
  const router = useRouter()
  const access = useAgentAccess()
  const {
    deployment,
    clients,
    transient,
    current,
    markCopied,
    markCopyFailed,
  } = access
  const verification = useAgentReadVerification({
    deployment,
    projectId: current?.id,
    transient,
    clientSupported: true,
  })
  if (deployment.kind === "unavailable") {
    return (
      <Alert>
        <AlertTitle>{deployment.headline}</AlertTitle>
        <AlertDescription className="grid gap-3">
          <p>{deployment.detail}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => router.refresh()}
          >
            Retry connection check
          </Button>
          <p>
            You can keep exploring evidence in Studio while the MCP connection
            is unavailable.
          </p>
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <div className="grid min-w-0 gap-4">
      <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-muted-foreground">
        {clients[0]?.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium">.cursor/mcp.json</p>
          <CopyButton
            value={cursorMcpConfig(deployment.mcpUrl)}
            label="Copy Cursor configuration"
            onCopied={() => markCopied({ kind: "client", client: "cursor" })}
            onCopyFailed={markCopyFailed}
          />
        </div>
        <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted p-4 text-xs leading-6 whitespace-pre-wrap text-foreground">
          {cursorMcpConfig(deployment.mcpUrl)}
        </pre>
        <p className="text-xs leading-6 text-muted-foreground">
          No key needed here. Keep your application write key in the server
          environment.
        </p>
      </div>
      <div className="grid gap-3 rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium">Check the connection in Cursor</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          {verificationCopy(verification)}
        </p>
        <CopyButton
          value={cursorConnectionPrompt(current)}
          label="Copy connection check"
          onCopyFailed={markCopyFailed}
        />
        <p className="text-xs leading-6 text-muted-foreground">
          Paste the check into Cursor. Both tool calls should succeed; an empty
          process list is fine.
        </p>
        <details className="text-xs leading-6 text-muted-foreground">
          <summary className="cursor-pointer">
            Preview connection-check prompt
          </summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs leading-6">
            {cursorConnectionPrompt(current)}
          </pre>
        </details>
      </div>
      <details className="text-xs leading-6 text-muted-foreground">
        <summary className="cursor-pointer">
          Advanced connection details
        </summary>
        <div className="mt-3 grid gap-2">
          <p>
            Studio records connection authentication. Only successful tool
            results verify a project read. Cursor edits code; the SDK sends
            evidence; MCP reads it.
          </p>
          <p>
            Flowmark uses Streamable HTTP with a registered public OAuth client.
            The configuration includes the required scopes; no client secret or
            ingestion key is needed.
          </p>
          <p>
            Cursor manages its callback: {cursorMcpRedirectUris.join(" or ")}.
            Custom-scheme callbacks and dynamic client registration are not
            supported.
          </p>
          <p>
            Endpoint: <code className="break-all">{deployment.mcpUrl}</code>
          </p>
          <p>
            To change approved projects, revoke the connection in Connect and
            sign in from Cursor again. Signing out of Studio does not revoke it.
          </p>
        </div>
      </details>
    </div>
  )
}
