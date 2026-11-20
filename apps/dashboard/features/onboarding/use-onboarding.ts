"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useApiOrigin } from "../platform/runtime-config"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import { useProjectKeys } from "../projects/keys-query"
import { useProject } from "../projects/project-context"
import type { CreatedSecret } from "../projects/types"
import { runInvestigationPath } from "../runs/investigation/investigation-navigation"
import { flowmarkAgentPrompt } from "./agent-prompt"
import { stepIndex, steps } from "./steps"
import {
  hasServerWriteKey,
  setupSecretForProject,
  type ScopedSetupSecret,
} from "./onboarding-state"

export function useOnboarding(initialStep: string, reviewMode = false) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const router = useRouter()
  const { current, projects } = useProject()
  const [requestedStep, setStep] = useState(() => stepIndex(initialStep))
  const step = !reviewMode && current?.role !== "owner" ? 0 : requestedStep
  const [secret, setSecret] = useState<ScopedSetupSecret | null>(null)
  const createdSecret = setupSecretForProject(secret, current?.id)
  const setCreatedSecret = (value: CreatedSecret, projectId: string) =>
    setSecret({ value, projectId })
  const currentStep = steps[step] ?? steps[0]!
  const canCheckRun =
    currentStep.id === "instrument" &&
    (current?.role === "owner" || current?.role === "viewer")
  const firstRunInput = {
    limit: 1,
    namespace: "application" as const,
  }
  const firstRun = useQuery({
    queryKey: [
      ...trpc.run.list.queryKey(firstRunInput),
      { projectId: current?.id ?? null },
    ],
    queryFn: ({ signal }) => client.run.list.query(firstRunInput, { signal }),
    enabled: canCheckRun,
    refetchInterval: false,
  })
  const recordedRun =
    canCheckRun && firstRun.isSuccess ? firstRun.data.runs[0] : undefined
  const keys = useProjectKeys({ retry: false })
  const hasWriteKey = keys.isSuccess && hasServerWriteKey(keys.data.apiKeys)
  const advance = useMutation(
    trpc.onboarding.advance.mutationOptions({
      onSuccess: () => undefined,
    }),
  )
  const complete = useMutation(trpc.onboarding.complete.mutationOptions())
  const finish = () => {
    const href = recordedRun ? runInvestigationPath(recordedRun.id, "/") : "/"
    if (reviewMode) {
      router.push(href)
      return
    }
    if (current) {
      complete.mutate(
        { projectId: current.id },
        {
          onSuccess: () => {
            router.push(href)
            router.refresh()
          },
        },
      )
    }
  }
  const origin = useApiOrigin()
  const snippet = useMemo(
    () => flowmarkAgentPrompt(origin, current),
    [origin, current],
  )

  const goTo = (next: number) => {
    const nextStep = steps[next]
    if (!nextStep) {
      return
    }
    advance.mutate(
      { step: nextStep.id, projectId: current?.id },
      {
        onSuccess: () => setStep(next),
      },
    )
  }

  const next = () => {
    if (reviewMode) {
      if (step === steps.length - 1) {
        finish()
        return
      }
      setStep((value) => value + 1)
      return
    }
    if (step === steps.length - 1) {
      finish()
      return
    }
    goTo(step + 1)
  }

  return {
    current,
    projects,
    keys,
    origin,
    step,
    setStep,
    createdSecret,
    setCreatedSecret,
    currentStep,
    hasWriteKey,
    canCheckRun,
    firstRun,
    recordedRun,
    advance,
    complete,
    snippet,
    next,
  }
}
