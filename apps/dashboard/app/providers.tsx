"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "@flowmark/server/trpc"
import { useState, type ReactNode } from "react"
import { ThemeProvider } from "next-themes"
import { TRPCProvider } from "../lib/trpc"

const apiUrl = "/api/trpc"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchInterval: 3000, retry: 1 } },
      }),
  )
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: apiUrl,
          headers() {
            if (typeof window === "undefined") {
              return {}
            }
            const projectId = window.localStorage.getItem("flowmark.projectId")
            return projectId
              ? { "x-flowmark-project-id": projectId }
              : {}
          },
          fetch(url, options) {
            return fetch(url, { ...options, credentials: "include" })
          },
        }),
      ],
    }),
  )

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          {children}
        </TRPCProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
