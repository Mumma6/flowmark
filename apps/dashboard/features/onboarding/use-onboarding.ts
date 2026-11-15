"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useApiOrigin } from "../platform/runtime-config"
import { useTRPC } from "../platform/api-trpc"
import { useProjectKeys } from "../projects/keys-query"
import { useProject } from "../projects/project-context"
import type { CreatedSecret } from "../projects/types"
import { flowmarkAgentPrompt } from "./agent-prompt"
import { stepIndex, steps } from "./steps"
import {
  hasServerWriteKey,
  setupSecretForProject,
  type ScopedSetupSecret,
} from "./onboarding-state"

export function useOnboarding(initialStep: string, reviewMode = false) {
  const trpc = useTRPC()
  const router = useRouter()
  const { current, projects } = useProject()
  const [requestedStep, setStep] = useState(() => stepIndex(initialStep))
  const step = !reviewMode && current?.role !== "owner" ? 0 : requestedStep
  const [secret, setSecret] = useState<ScopedSetupSecret | null>(null)
  const createdSecret = setupSecretForProject(secret, current?.id)
  const setCreatedSecret = (value: CreatedSecret, projectId: string) =>
    setSecret({ value, projectId })
  const currentStep = steps[step] ?? steps[0]!
  const keys = useProjectKeys({ retry: false })
  const snapshot = useQuery({
    ...trpc.onboarding.snapshot.queryOptions(current?.id ?? ""),
    enabled: Boolean(current?.id),
    retry: false,
  })
  const hasWriteKey = keys.isSuccess && hasServerWriteKey(keys.data.apiKeys)
  const hasRuns = snapshot.isSuccess && snapshot.data.metrics.totalRuns > 0
  const advance = useMutation(
    trpc.onboarding.advance.mutationOptions({
      onSuccess: () => undefined,
    }),
  )
  const complete = useMutation(
    trpc.onboarding.complete.mutationOptions({
      onSuccess: () => {
        router.push("/")
        router.refresh()
      },
    }),
  )
  const origin = useApiOrigin()
  const snippet = useMemo(() => flowmarkAgentPrompt(origin), [origin])

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
        router.push("/")
        return
      }
      setStep((value) => value + 1)
      return
    }
    if (step === steps.length - 1) {
      if (current) {
        complete.mutate({ projectId: current.id })
      }
      return
    }
    goTo(step + 1)
  }

  return {
    current,
    projects,
    snapshot,
    keys,
    origin,
    step,
    setStep,
    createdSecret,
    setCreatedSecret,
    currentStep,
    hasWriteKey,
    hasRuns,
    advance,
    complete,
    snippet,
    next,
  }
}
