"use client"

import { toast } from "@flowmark/ui"
import { useMutation } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useTRPC } from "../platform/api-trpc"
import { authClient } from "../auth/auth-client"
import { useProject } from "./project-context"
import type { CreatedSecret } from "./types"

export function useCreateProject(onCreated?: (secret: CreatedSecret) => void) {
  const trpc = useTRPC()
  const session = authClient.useSession()
  const email = session.data?.user.email ?? ""
  const { current, select, projects } = useProject()
  const [newName, setNewName] = useState("")
  const [secret, setSecret] = useState<CreatedSecret | null>(null)
  const [shownFor, setShownFor] = useState<string | null>(null)
  const previousEmail = useRef(email)
  useEffect(() => {
    if (previousEmail.current && email && previousEmail.current !== email) {
      setSecret(null)
      setShownFor(null)
    }
    previousEmail.current = email
  }, [email])
  useEffect(() => {
    if (shownFor && current?.id && current.id !== shownFor) {
      setSecret(null)
      setShownFor(null)
    }
  }, [current?.id, shownFor])
  const create = useMutation(
    trpc.project.create.mutationOptions({
      onSuccess: (result) => {
        toast.add({ title: "Project created", type: "success" })
        setSecret(result.writeKey)
        setShownFor(result.project.id)
        setNewName("")
        select(result.project.id)
        onCreated?.(result.writeKey)
      },
    }),
  )
  return { projects, newName, setNewName, secret, create }
}
