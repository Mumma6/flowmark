"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTRPC } from "../../platform/api-trpc"
import { useApiOrigin } from "../../platform/runtime-config"
import { useProject } from "../../projects/project-context"
import {
  buildRepositoryConnectPayload,
  defaultRepositoryConnectDraft,
  installationBootstrapView,
  repositoryWriterPermissions,
  type InstallationBootstrapView,
  type RepositoryConnectFormDraft,
} from "./repository-connection-model"

export interface ConnectReceipt {
  readonly installationId: string
  readonly repository: string
  readonly environment: string
  readonly deploymentToken: string
  readonly bootstrap: InstallationBootstrapView
}

export function useRepositoryConnections() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { current } = useProject()
  const apiOrigin = useApiOrigin()
  const projectId = current?.id ?? null

  const list = useQuery({
    ...trpc.repositoryInstallation.list.queryOptions({
      projectId: projectId ?? "00000000-0000-0000-0000-000000000000",
    }),
    enabled: projectId !== null,
  })

  const connectMutation = useMutation(
    trpc.repositoryInstallation.connect.mutationOptions(),
  )
  const prepareMutation = useMutation(
    trpc.repositoryInstallation.prepareBootstrapPr.mutationOptions(),
  )
  const revokeMutation = useMutation(
    trpc.repositoryInstallation.revoke.mutationOptions(),
  )

  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<RepositoryConnectFormDraft>(
    defaultRepositoryConnectDraft,
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ConnectReceipt | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(
    null,
  )
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const updateDraft = (patch: Partial<RepositoryConnectFormDraft>) => {
    setFormError(null)
    setDraft((previous) => ({ ...previous, ...patch }))
  }

  const refreshList = async () => {
    if (!projectId) {
      return
    }
    await queryClient.invalidateQueries({
      queryKey: trpc.repositoryInstallation.list.queryKey({ projectId }),
    })
  }

  const submitConnect = async () => {
    if (!projectId || connectMutation.isPending || prepareMutation.isPending) {
      return
    }
    const built = buildRepositoryConnectPayload(projectId, draft)
    if (!built.ok) {
      setFormError(built.error)
      return
    }
    setFormError(null)
    try {
      const created = await connectMutation.mutateAsync(built.payload)
      let bootstrap: InstallationBootstrapView
      try {
        const prepared = await prepareMutation.mutateAsync({
          projectId,
          installationId: created.installation.id,
          apiOrigin,
          permissions: repositoryWriterPermissions,
        })
        bootstrap = installationBootstrapView(prepared)
      } catch (error) {
        bootstrap = {
          status: "not-prepared",
          detail:
            error instanceof Error
              ? error.message
              : "The installation pull request could not be prepared.",
        }
      }
      setReceipt({
        installationId: created.installation.id,
        repository: created.installation.repository,
        environment: created.installation.environment,
        deploymentToken: created.deploymentToken,
        bootstrap,
      })
      setCopiedToken(false)
      setDraft(defaultRepositoryConnectDraft)
      setShowForm(false)
      await refreshList()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not connect repository.",
      )
    }
  }

  const copyDeploymentToken = async () => {
    if (!receipt || typeof navigator === "undefined" || !navigator.clipboard) {
      return
    }
    try {
      await navigator.clipboard.writeText(receipt.deploymentToken)
      setCopiedToken(true)
    } catch {
      setCopiedToken(false)
    }
  }

  const confirmRevoke = async () => {
    if (!projectId || !confirmingRevokeId || revokeMutation.isPending) {
      return
    }
    setRevokeError(null)
    try {
      await revokeMutation.mutateAsync({
        projectId,
        installationId: confirmingRevokeId,
      })
      setConfirmingRevokeId(null)
      await refreshList()
    } catch (error) {
      setRevokeError(
        error instanceof Error
          ? error.message
          : "Could not revoke repository installation.",
      )
    }
  }

  const installations = list.data ?? []
  const confirmingInstallation =
    installations.find((item) => item.id === confirmingRevokeId) ?? null

  return {
    projectId,
    list,
    installations,
    showForm,
    setShowForm,
    draft,
    updateDraft,
    formError,
    connectPending: connectMutation.isPending || prepareMutation.isPending,
    submitConnect,
    receipt,
    dismissReceipt: () => {
      setReceipt(null)
      setCopiedToken(false)
    },
    copiedToken,
    copyDeploymentToken,
    confirmingInstallation,
    setConfirmingRevokeId,
    revokePending: revokeMutation.isPending,
    revokeError,
    confirmRevoke,
  }
}
