"use client"

import { createTRPCContext } from "@trpc/tanstack-react-query"
import type { AppRouter } from "@flowmark/server/trpc"

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()
