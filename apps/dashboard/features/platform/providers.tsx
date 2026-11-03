"use client"

import { Toaster } from "@flowmark/ui"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useState, type ReactNode } from "react"
import {
  createDashboardQueryClient,
  createDashboardTRPCClient,
} from "./api-browser-client"
import { TRPCProvider } from "./api-trpc"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createDashboardQueryClient)
  const [trpcClient] = useState(createDashboardTRPCClient)

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
          <Toaster />
        </TRPCProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
