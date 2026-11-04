"use client"

import type { AppRouter } from "@flowmark/server/trpc"
import { QueryClient } from "@tanstack/react-query"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { readStoredProjectId } from "../projects/project-selection"
import { dashboardTrpcFetch } from "./api-transport-errors"
import { publicConfig } from "./config-public"

export const createDashboardQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: publicConfig.query },
  })

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
