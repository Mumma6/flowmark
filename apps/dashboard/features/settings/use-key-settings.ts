"use client"

import { toast } from "@flowmark/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useTRPC } from "../platform/api-trpc"
import { authClient } from "../auth/auth-client"
import { useProjectKeys } from "../projects/keys-query"
import { useProject } from "../projects/project-context"
import type { CreatedSecret } from "../projects/types"

type KeyAction = {
  readonly intent: "rotate" | "revoke"
  readonly kind: "api" | "browser"
  readonly id: string
  readonly name: string
  readonly prefix: string
}

export function useKeySettings() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const session = authClient.useSession()
  const email = session.data?.user.email ?? ""
  const { current, projects } = useProject()
  const keys = useProjectKeys()
  const [writeName, setWriteName] = useState("Write key")
  const [browserName, setBrowserName] = useState("Browser key")
  const [origins, setOrigins] = useState("http://localhost:3000")
  const [secret, setSecret] = useState<CreatedSecret | null>(null)
  const [secretSource, setSecretSource] = useState<
    "created" | "rotated" | null
  >(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [action, setAction] = useState<KeyAction | null>(null)
  const previousEmail = useRef(email)
  const confirming = useRef(false)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    setSecret(null)
    setSecretSource(null)
    setNotice(null)
    setAction(null)
  }, [current?.id])
  useEffect(() => {
    if (previousEmail.current && email && previousEmail.current !== email) {
      setSecret(null)
      setSecretSource(null)
      setNotice(null)
      setAction(null)
    }
    previousEmail.current = email
  }, [email])
  const createWrite = useMutation(
    trpc.project.createWriteKey.mutationOptions({
      onSuccess: (created) => {
        setSecret(created)
        toast.add({
          title: "Ingestion key created",
          type: "success",
          description: "Copy the key from the form and store it securely.",
        })
        setSecretSource("created")
        setNotice(null)
        void queryClient.invalidateQueries()
      },
    }),
  )
  const rotate = useMutation(
    trpc.project.rotateWriteKey.mutationOptions({
      retry: false,
      onSuccess: (created) => {
        setSecret(created)
        toast.add({
          title: "Write key rotated",
          type: "success",
          description:
            "Replace the old key in your application with the new key shown below.",
        })
        setSecretSource("rotated")
        setNotice(null)
        void queryClient.invalidateQueries()
      },
    }),
  )
  const revokeApi = useMutation(
    trpc.project.revokeApiKey.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries(),
    }),
  )
  const createBrowser = useMutation(
    trpc.project.createBrowserKey.mutationOptions({
      onSuccess: (created) => {
        setSecret(created)
        toast.add({
          title: "Ingestion key created",
          type: "success",
          description: "Copy the key from the form and store it securely.",
        })
        setSecretSource("created")
        setNotice(null)
        void queryClient.invalidateQueries()
      },
    }),
  )
  const revokeBrowser = useMutation(
    trpc.project.revokeBrowserKey.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries(),
    }),
  )
  const busy =
    rotate.isPending || revokeApi.isPending || revokeBrowser.isPending
  useEffect(() => {
    if (!busy) {
      confirming.current = false
    }
  }, [busy])
  const ask = (next: KeyAction, trigger: HTMLButtonElement) => {
    returnFocus.current = trigger
    setNotice(null)
    setAction(next)
  }
  const closeAction = () => {
    if (busy) {
      return
    }
    setAction(null)
    returnFocus.current?.focus()
  }
  const confirmAction = () => {
    if (!current || !action || busy || confirming.current) {
      return
    }
    confirming.current = true
    setNotice(null)
    const input = { projectId: current.id, keyId: action.id }
    if (action.intent === "rotate") {
      rotate.mutate(input, {
        onSuccess: () => {
          setAction(null)
          returnFocus.current?.focus()
        },
        onSettled: () => {
          confirming.current = false
        },
      })
      return
    }
    const revoke = action.kind === "browser" ? revokeBrowser : revokeApi
    const revoked = action
    revoke.mutate(input, {
      onSuccess: () => {
        setAction(null)
        returnFocus.current?.focus()
        setSecret((currentSecret) =>
          currentSecret?.id === revoked.id ? null : currentSecret,
        )
        if (secret?.id === revoked.id) {
          setSecretSource(null)
        }
        toast.add({ title: "Ingestion key revoked", type: "success" })
        setNotice(
          `Revoked ${revoked.name} (${revoked.prefix}…). Applications using it can no longer authenticate.`,
        )
      },
      onSettled: () => {
        confirming.current = false
      },
    })
  }
  return {
    current,
    projects,
    keys,
    writeName,
    setWriteName,
    browserName,
    setBrowserName,
    origins,
    setOrigins,
    secret,
    secretSource,
    notice,
    action,
    createWrite,
    createBrowser,
    busy,
    ask,
    closeAction,
    confirmAction,
    rotate,
    revokeApi,
    revokeBrowser,
  }
}
