"use client"

import { useEffect, useState } from "react"
import { authClient } from "../auth/auth-client"
import { useProject } from "../projects/project-context"

export function useRunHandoffCopyState() {
  const { current } = useProject()
  const session = authClient.useSession()
  const email = session.data?.user.email ?? ""
  const [contextCopied, setContextCopied] = useState(false)

  useEffect(() => {
    setContextCopied(false)
  }, [current?.id, email])

  return {
    contextCopied,
    markContextCopied: () => setContextCopied(true),
  }
}
