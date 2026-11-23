"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@flowmark/ui"
import {
  formatAllowedNamespaces,
  installationColdStartSummary,
  installationStatusBadgeVariant,
  installationStatusLabel,
} from "./repository-connection-model"
import { useRepositoryConnections } from "./use-repository-connections"

export function RepositoryConnections() {
  const {
    list,
    installations,
    showForm,
    setShowForm,
    draft,
    updateDraft,
    formError,
    connectPending,
    submitConnect,
    receipt,
    dismissReceipt,
    copiedToken,
    copyDeploymentToken,
    confirmingInstallation,
    setConfirmingRevokeId,
    revokePending,
    revokeError,
    confirmRevoke,
  } = useRepositoryConnections()

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <CardTitle>Connected repositories & environments</CardTitle>
          <CardDescription>
            Connect a GitHub repository and Node runtime under explicit field,
            retention and overhead policy. Repository PR writing, deployment
            attestation, ingestion write keys and delegated agent reads stay
            separate authorities.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant={showForm ? "outline" : "default"}
          onClick={() => setShowForm((open) => !open)}
        >
          {showForm ? "Close form" : "Connect repository"}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        {receipt ? (
          <Alert>
            <AlertTitle>
              Repository connected: {receipt.repository} ({receipt.environment})
            </AlertTitle>
            <AlertDescription className="grid gap-3">
              <p>
                Copy this one-time deployment attestation token now and bind it
                as <code>FLOWMARK_DEPLOYMENT_TOKEN</code> in your deployment
                environment. Never place secrets in source files, PR diffs or
                chat.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded border border-border bg-muted px-2 py-1 text-[11px] text-foreground">
                  {receipt.deploymentToken}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyDeploymentToken()}
                >
                  {copiedToken ? "Copied token" : "Copy token"}
                </Button>
              </div>
              <p className="text-muted-foreground">
                {receipt.bootstrap.status === "opened" ? (
                  <>
                    Bootstrap pull request:{" "}
                    <a
                      href={receipt.bootstrap.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-4"
                    >
                      #{receipt.bootstrap.number} ({receipt.bootstrap.branch})
                    </a>
                  </>
                ) : receipt.bootstrap.status === "pr-not-opened" ? (
                  "The pull request was not created. Apply these files in the repository."
                ) : (
                  receipt.bootstrap.detail
                )}
              </p>
              {receipt.bootstrap.status === "pr-not-opened" ? (
                <div className="grid gap-3">
                  <p className="text-muted-foreground">
                    {receipt.bootstrap.detail}
                  </p>
                  <ul className="grid gap-3">
                    {receipt.bootstrap.files.map((file) => (
                      <li key={file.path} className="grid gap-1">
                        <p className="font-medium text-foreground">
                          {file.path}
                        </p>
                        <pre className="max-h-48 overflow-auto rounded border border-border bg-muted p-2 text-[11px] text-foreground">
                          {file.content}
                        </pre>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="justify-self-start"
                onClick={dismissReceipt}
              >
                I saved this token
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {showForm ? (
          <form
            className="grid gap-4 rounded-lg border border-border p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submitConnect()
            }}
          >
            <div className="grid gap-1">
              <h3 className="font-medium text-foreground">
                Connect a repository under policy
              </h3>
              <p className="text-muted-foreground">
                Narrow PR writer permissions only (contents:write,
                pull_requests:write, metadata:read — no merge or repository
                administration). Raw payloads remain disabled.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="font-medium text-foreground">
                  Repository (owner/repo)
                </span>
                <Input
                  name="repository"
                  placeholder="acme/checkout-service"
                  value={draft.repository}
                  onChange={(event) =>
                    updateDraft({ repository: event.target.value })
                  }
                  required
                />
              </label>
              <label className="grid gap-1">
                <span className="font-medium text-foreground">Service</span>
                <Input
                  name="service"
                  placeholder="checkout-api"
                  value={draft.service}
                  onChange={(event) =>
                    updateDraft({ service: event.target.value })
                  }
                  required
                />
              </label>
              <label className="grid gap-1">
                <span className="font-medium text-foreground">Environment</span>
                <Input
                  name="environment"
                  placeholder="staging"
                  value={draft.environment}
                  onChange={(event) =>
                    updateDraft({ environment: event.target.value })
                  }
                  required
                />
              </label>
              <label className="grid gap-1">
                <span className="font-medium text-foreground">
                  GitHub installation ID
                </span>
                <Input
                  name="externalInstallationId"
                  placeholder="12345678"
                  value={draft.externalInstallationId}
                  onChange={(event) =>
                    updateDraft({ externalInstallationId: event.target.value })
                  }
                  required
                />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="font-medium text-foreground">
                Allowed reference namespaces (kind:namespace, comma-separated)
              </span>
              <Input
                name="allowedNamespaces"
                placeholder="entity:order, change:checkout"
                value={draft.allowedNamespacesText}
                onChange={(event) =>
                  updateDraft({ allowedNamespacesText: event.target.value })
                }
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1">
                <span className="font-medium text-foreground">
                  Retention (days, 1–90)
                </span>
                <Input
                  name="retentionDays"
                  type="number"
                  min={1}
                  max={90}
                  value={draft.retentionDays}
                  onChange={(event) =>
                    updateDraft({ retentionDays: event.target.value })
                  }
                  required
                />
              </label>
              <label className="grid gap-1">
                <span className="font-medium text-foreground">
                  Max overhead (ms, 1–100)
                </span>
                <Input
                  name="maxOverheadMs"
                  type="number"
                  min={1}
                  max={100}
                  value={draft.maxOverheadMs}
                  onChange={(event) =>
                    updateDraft({ maxOverheadMs: event.target.value })
                  }
                  required
                />
              </label>
              <label className="grid gap-1">
                <span className="font-medium text-foreground">
                  Rate budget (events/min)
                </span>
                <Input
                  name="maxEventsPerMinute"
                  type="number"
                  min={1}
                  max={10000}
                  value={draft.maxEventsPerMinute}
                  onChange={(event) =>
                    updateDraft({ maxEventsPerMinute: event.target.value })
                  }
                  required
                />
              </label>
            </div>
            {formError ? (
              <Alert>
                <AlertTitle>Could not connect repository</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={connectPending}>
                {connectPending
                  ? "Connecting & preparing bootstrap PR…"
                  : "Connect & issue deployment token"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={connectPending}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {list.isPending ? (
          <p className="text-muted-foreground">
            Loading connected repositories…
          </p>
        ) : null}

        {list.isError ? (
          <Alert>
            <AlertTitle>Repository installations unavailable</AlertTitle>
            <AlertDescription className="grid gap-2">
              <p>
                Could not load connected repositories for this project. Retry to
                check again.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="justify-self-start"
                onClick={() => void list.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!list.isPending && !list.isError && installations.length === 0 ? (
          <p className="text-muted-foreground">
            No repositories connected yet. Connect a GitHub repository and
            environment to prepare a bootstrap PR and explicit collection
            policy.
          </p>
        ) : null}

        {installations.length > 0 ? (
          <ul
            className="grid gap-3"
            aria-label="Connected repositories and environments"
          >
            {installations.map((installation) => (
              <li
                key={installation.id}
                className="grid gap-2 rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {installation.repository}
                    </span>
                    <Badge variant="outline">
                      {installation.service} · {installation.environment}
                    </Badge>
                    <Badge variant="outline">
                      {installation.host} · {installation.runtime}
                    </Badge>
                    <Badge
                      variant={installationStatusBadgeVariant(
                        installation.status,
                      )}
                    >
                      {installationStatusLabel(installation.status)}
                    </Badge>
                  </div>
                  {installation.status !== "revoked" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmingRevokeId(installation.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </div>
                <p className="text-muted-foreground">
                  {installationColdStartSummary(installation.coldStartStatus)}
                </p>
                <p className="text-muted-foreground">
                  Policy:{" "}
                  <span className="text-foreground">
                    {formatAllowedNamespaces(
                      installation.policy.allowedNamespaces,
                    )}
                  </span>
                  {" · "}
                  {installation.policy.retentionDays}d retention{" · "}≤
                  {installation.policy.maxOverheadMs}ms overhead{" · "}≤
                  {installation.policy.maxEventsPerMinute}/min · raw payloads
                  blocked
                </p>
                {installation.bootstrapPr ? (
                  <p className="text-muted-foreground">
                    Bootstrap PR:{" "}
                    <a
                      href={installation.bootstrapPr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-4"
                    >
                      #{installation.bootstrapPr.number} (
                      {installation.bootstrapPr.branch})
                    </a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>

      <Dialog
        open={confirmingInstallation !== null}
        disablePointerDismissal={revokePending}
        onOpenChange={(open) => {
          if (!open && !revokePending) {
            setConfirmingRevokeId(null)
          }
        }}
      >
        <DialogContent showCloseButton={!revokePending}>
          <DialogHeader>
            <DialogTitle>Revoke repository installation</DialogTitle>
            <DialogDescription>
              {confirmingInstallation
                ? `Revoke ${confirmingInstallation.repository} (${confirmingInstallation.service} / ${confirmingInstallation.environment}). This revokes the installation and any delegated session linked to it, while leaving independently issued ingestion keys and unrelated agent sessions intact.`
                : "Revoke the selected repository installation."}
            </DialogDescription>
          </DialogHeader>
          {revokeError ? (
            <Alert>
              <AlertTitle>Revocation failed</AlertTitle>
              <AlertDescription>{revokeError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={revokePending}
              onClick={() => setConfirmingRevokeId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={revokePending}
              onClick={() => void confirmRevoke()}
            >
              {revokePending ? "Revoking…" : "Revoke installation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
