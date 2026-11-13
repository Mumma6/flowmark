"use client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { BusinessEvidenceQuery } from "@flowmarkdev/core"
import { authClient } from "../auth/auth-client"
import { useTRPCClient } from "../platform/api-trpc"
export function useBusinessEvidence(
  projectId: string,
  selection: BusinessEvidenceQuery | null,
) {
  const identity = authClient.useSession()
  const client = useTRPCClient()
  const cache = useQueryClient()
  const scope = [
    identity.data?.user.id,
    identity.data?.session.id,
    projectId,
  ] as const
  const capabilitiesKey = ["business-capabilities", ...scope] as const
  const capabilities = useQuery({
    queryKey: capabilitiesKey,
    queryFn: ({ signal }) =>
      client.businessEvidence.capabilities.query(undefined, { signal }),
    enabled: Boolean(identity.data),
    gcTime: 0,
    retry: false,
  })
  const revision = capabilities.data?.publicationRevision
  const evidence = useQuery({
    queryKey: ["business-evidence", ...scope, revision, selection],
    queryFn: async ({ signal }) => {
      if (!selection) {
        throw new Error("Unsupported business selection.")
      }
      const value = await client.businessEvidence.read.query(selection, {
        signal,
      })
      cache.setQueryData(
        capabilitiesKey,
        (previous: typeof capabilities.data) =>
          previous &&
          previous.publicationRevision < value.projection.publicationRevision
            ? {
                ...previous,
                publicationRevision: value.projection.publicationRevision,
              }
            : previous,
      )
      return value
    },
    enabled: Boolean(
      selection && identity.data && capabilities.data && !capabilities.isError,
    ),
    gcTime: 0,
    retry: false,
  })
  return {
    capabilities,
    evidence,
    identity,
    retry: () => Promise.all([capabilities.refetch(), evidence.refetch()]),
  }
}
