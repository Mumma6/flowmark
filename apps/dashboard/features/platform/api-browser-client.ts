"use client"

import type { AppRouter } from "@flowmark/server/trpc"
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { readStoredProjectId } from "../projects/project-selection"
import { dashboardTrpcFetch } from "./api-transport-errors"
import { publicConfig } from "./config-public"
import { isAuthorizationFailure } from "../auth/session-recovery"
import { createSessionFailureHandler } from "../auth/session-recovery-runtime"

export const createDashboardQueryClient = (
  onExpired: () => void = () => {},
) => {
  const handleFailure = (error: unknown) => onFailure(error)
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: handleFailure }),
    mutationCache: new MutationCache({ onError: handleFailure }),
    defaultOptions: {
      queries: {
        ...publicConfig.query,
        refetchInterval: (query) =>
          isAuthorizationFailure(query.state.error)
            ? false
            : publicConfig.query.refetchInterval,
        retry: (count, error) =>
          !isAuthorizationFailure(error) && count < publicConfig.query.retry,
      },
    },
  })
  const onFailure = createSessionFailureHandler(client, onExpired)
  return client
}

export const createDashboardTRPCClient = () =>
  createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: publicConfig.trpcPath,
        headers() {
          const projectId = readStoredProjectId()
          return projectId ? { "x-flowmark-project-id": projectId } : {}
        },
        fetch: dashboardTrpcFetch,
      }),
    ],
  })
