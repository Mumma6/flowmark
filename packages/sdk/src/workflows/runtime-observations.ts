import { createHmac } from "node:crypto"
import {
  RuntimeObservationSchema,
  RuntimeProbeReferenceSchema,
  RuntimeReferenceKindSchema,
  RuntimeReferenceNamespaceSchema,
  type RuntimeObservation,
  type RuntimeProbeReference,
  type RuntimeReferenceKind,
} from "@flowmarkdev/core"
import { Array, Option, Schema } from "effect"
import type { Flow } from "../types/index.js"

type Values = Partial<
  Record<RuntimeReferenceKind, Readonly<Record<string, string>>>
>

interface RuntimeObservationEmitter {
  observe(flow: Flow, values?: Values): void
  reportLoss(flow: Flow, count: number): void
}

type Reference = {
  readonly kind: RuntimeReferenceKind
  readonly namespace: string
}

/** Keep the project-specific key in the application secret store. Raw values never enter delivery. */
export function createRuntimeObservationEmitter(policy: {
  readonly enabled?: boolean
  readonly key: string
  readonly namespaces: readonly Reference[]
  readonly probe?: RuntimeProbeReference
}): RuntimeObservationEmitter {
  if (policy.enabled === false) {
    return {
      observe: () => undefined,
      reportLoss: () => undefined,
    } satisfies RuntimeObservationEmitter
  }
  const probe = Schema.decodeUnknownOption(RuntimeProbeReferenceSchema)(
    policy.probe,
  )
  const namespaces = Array.take(
    Array.filter(
      policy.namespaces,
      ({ kind, namespace }) =>
        Schema.is(RuntimeReferenceKindSchema)(kind) &&
        Schema.is(RuntimeReferenceNamespaceSchema)(namespace),
    ),
    12,
  )
  const emit = (flow: Flow, observation: RuntimeObservation) => {
    flow.step("runtime.observation", {
      observation: {
        ...observation,
        ...Option.match(probe, {
          onNone: () => ({}),
          onSome: (value) => ({ probe: value }),
        }),
      },
    })
  }

  return {
    observe(flow: Flow, values: Values = {}) {
      const references = Array.flatMap(namespaces, ({ kind, namespace }) => {
        const group = values[kind]
        const value =
          group && Object.hasOwn(group, namespace)
            ? group[namespace]
            : undefined
        if (
          typeof value !== "string" ||
          value.length === 0 ||
          value.length > 512 ||
          policy.key.length < 32
        ) {
          return []
        }
        const digest = createHmac("sha256", policy.key)
          .update(JSON.stringify([kind, namespace, value]))
          .digest("hex")
        return [{ kind, namespace, digest: `hmac-sha256:${digest}` }]
      })
      emit(flow, { kind: "observation", references })
    },
    reportLoss(flow: Flow, count: number) {
      const event = { kind: "loss", count } as const
      if (Schema.is(RuntimeObservationSchema)(event)) {
        emit(flow, event)
      }
    },
  }
}
