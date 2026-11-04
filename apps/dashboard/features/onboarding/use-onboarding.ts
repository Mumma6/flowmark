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

export function useOnboarding(initialStep: string, reviewMode = false) {
  const trpc = useTRPC()
  const router = useRouter()
  const { current, projects } = useProject()
  const [step, setStep] = useState(() => stepIndex(initialStep))
  const [createdSecret, setCreatedSecret] = useState<CreatedSecret | null>(null)
  const currentStep = steps[step] ?? steps[0]!
  const keys = useProjectKeys()
  const snapshot = useQuery({
    ...trpc.project.snapshot.queryOptions(),
    enabled: Boolean(current?.id),
  })
  const hasWriteKey = (keys.data?.apiKeys.length ?? 0) > 0
  const hasRuns = (snapshot.data?.metrics.totalRuns ?? 0) > 0
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
  const snippet = useMemo(
    () => `${flowmarkAgentPrompt(origin)}\n\nFLOWMARK_API_URL=${origin}`,
    [origin],
  )

  const goTo = (next: number) => {
    const nextStep = steps[next]
    if (!nextStep) {
      return
    }
    advance.mutate(
      { step: nextStep.id },
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
      complete.mutate()
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
