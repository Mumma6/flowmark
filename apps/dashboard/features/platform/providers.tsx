"use client"

import { Button, Toaster } from "@flowmark/ui"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useState, type ReactNode } from "react"
import {
  createDashboardQueryClient,
  createDashboardTRPCClient,
} from "./api-browser-client"
import { TRPCProvider } from "./api-trpc"
import { RecoveryScreen } from "../support/recovery-screen"
import { studioReturnPath } from "../auth/studio-return-path"

export function Providers({ children }: { children: ReactNode }) {
  const [expired, setExpired] = useState(false)
  const [queryClient] = useState(() =>
    createDashboardQueryClient(() => setExpired(true)),
  )
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
          {expired ? (
            <RecoveryScreen
              title="Sign in again"
              description="Your session has ended. Private data has been cleared. Sign in to continue; your last action will not be repeated automatically."
            >
              <Button asChild className="w-fit">
                <a
                  href={`/sign-in?returnTo=${encodeURIComponent(studioReturnPath(window.location.pathname) ?? "/")}`}
                >
                  Sign in
                </a>
              </Button>
            </RecoveryScreen>
          ) : (
            children
          )}
          <Toaster />
        </TRPCProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
