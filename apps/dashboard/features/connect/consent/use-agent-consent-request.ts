"use client"

import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { readConsentView } from "./consent-browser"

export function useConsentRequest() {
  const params = useSearchParams()
  const oauthQuery = params.toString()
  const query = useQuery({
    queryKey: ["agent-consent", oauthQuery],
    queryFn: ({ signal }) => readConsentView(oauthQuery, signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  return { oauthQuery, query }
}
