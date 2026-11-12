import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Match from "effect/Match"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Result from "effect/Result"
import {
  decodeToolEvidence,
  type ToolEvidence,
  type EvidenceInvocation,
} from "./tool-result.js"
import {
  EvidenceReadError,
  readFailure,
  type EvidenceAction,
  type EvidenceMessage,
  type EvidenceViewState,
} from "./lifecycle.js"

/** Only the host adapter can perform a read; this session has no transport or credentials. */
export class EvidenceReader extends Context.Service<
  EvidenceReader,
  {
    readonly read: (
      invocation: EvidenceInvocation,
    ) => Effect.Effect<unknown, EvidenceReadError>
  }
>()("@flowmark/evidence-view/EvidenceReader") {}

export type EvidenceEvent =
  | { readonly _tag: "Input"; readonly args: unknown }
  | { readonly _tag: "Result"; readonly result: unknown }
  | { readonly _tag: "Action"; readonly action: EvidenceAction }
  | {
      readonly _tag: "Read"
      readonly revision: number
      readonly invocation: EvidenceInvocation
      readonly result: Result.Result<unknown, EvidenceReadError>
    }
  | { readonly _tag: "Connected"; readonly canRead: boolean }
  | { readonly _tag: "Clear"; readonly state: EvidenceMessage }
  | { readonly _tag: "Close" }

type Session = {
  readonly revision: number
  readonly args: Option.Option<unknown>
  readonly evidence: Option.Option<ToolEvidence>
  readonly request: Option.Option<Fiber.Fiber<void>>
  readonly canRead: boolean
}
const initial: Session = {
  revision: 0,
  args: Option.none(),
  evidence: Option.none(),
  request: Option.none(),
  canRead: false,
}

export const makeEvidenceSession = Effect.fn("EvidenceView.makeSession")(
  function* (
    render: (state: EvidenceViewState) => void,
    emit: (event: EvidenceEvent) => Effect.Effect<unknown>,
  ) {
    const reader = yield* EvidenceReader
    const session = yield* Ref.make(initial)
    const message = (state: EvidenceMessage) => Effect.sync(() => render(state))
    const show = (value: Session) =>
      Option.match(value.evidence, {
        onNone: () => Effect.void,
        onSome: (evidence) =>
          Effect.sync(() =>
            render({
              kind: "snapshot",
              evidence,
              busy: Option.isSome(value.request),
              canRead: value.canRead,
            }),
          ),
      })
    const invalidate = Effect.gen(function* () {
      const previous = yield* Ref.get(session)
      yield* Ref.set(session, {
        ...initial,
        revision: previous.revision + 1,
        canRead: previous.canRead,
      })
      yield* Option.match(previous.request, {
        onNone: () => Effect.void,
        onSome: Fiber.interrupt,
      })
    })
    const accept = Effect.fn("EvidenceView.accept")(function* (
      args: unknown,
      result: unknown,
    ) {
      const decoded = decodeToolEvidence(args, result)
      yield* Result.match(decoded, {
        onFailure: (error) =>
          invalidate.pipe(
            Effect.andThen(
              message({
                ...readFailure(result),
                message: error.reason + " " + readFailure(result).message,
              }),
            ),
          ),
        onSuccess: (evidence) =>
          Ref.updateAndGet(session, (current) => ({
            ...current,
            args: Option.some(evidence.invocation),
            evidence: Option.some(evidence),
            request: Option.none(),
          })).pipe(Effect.andThen(show)),
      })
    })

    return {
      handle: Effect.fn("EvidenceView.handle")((event: EvidenceEvent) =>
        Match.value(event).pipe(
          Match.tag("Input", ({ args }) =>
            invalidate.pipe(
              Effect.andThen(
                Ref.update(session, (value) => ({
                  ...value,
                  args: Option.some(args),
                })),
              ),
              Effect.andThen(
                message({
                  kind: "message",
                  status: "waiting",
                  message: "Waiting for the completed evidence result…",
                }),
              ),
            ),
          ),
          Match.tag("Result", ({ result }) =>
            Effect.gen(function* () {
              const current = yield* Ref.get(session)
              yield* invalidate
              yield* accept(Option.getOrUndefined(current.args), result)
            }),
          ),
          Match.tag("Clear", ({ state }) =>
            invalidate.pipe(Effect.andThen(message(state))),
          ),
          Match.tag("Close", () =>
            invalidate.pipe(
              Effect.andThen(
                message({
                  kind: "message",
                  status: "closed",
                  message:
                    "The host connection closed. Previous evidence and actions have been cleared.",
                }),
              ),
              Effect.andThen(Effect.interrupt),
            ),
          ),
          Match.tag("Connected", ({ canRead }) =>
            Ref.updateAndGet(session, (current) => ({
              ...current,
              canRead,
            })).pipe(Effect.andThen(show)),
          ),
          Match.tag("Action", ({ action }) =>
            Effect.gen(function* () {
              const current = yield* Ref.get(session)
              if (
                !current.canRead ||
                Option.isSome(current.request) ||
                Option.isNone(current.evidence)
              ) {
                return
              }
              const evidence = current.evidence.value
              if (action === "next" && evidence.nextCursor === null) {
                return
              }
              const invocation: EvidenceInvocation = {
                ...evidence.invocation,
                ...(action === "next" ? { cursor: evidence.nextCursor! } : {}),
              }
              const request = yield* reader.read(invocation).pipe(
                Effect.result,
                Effect.andThen((result) =>
                  emit({
                    _tag: "Read",
                    revision: current.revision,
                    invocation,
                    result,
                  }),
                ),
                Effect.asVoid,
                Effect.forkScoped,
              )
              const value = yield* Ref.updateAndGet(session, (state) => ({
                ...state,
                request: Option.some(request),
              }))
              yield* show(value)
            }),
          ),
          Match.tag("Read", ({ revision, invocation, result }) =>
            Effect.gen(function* () {
              const current = yield* Ref.get(session)
              if (revision !== current.revision) {
                return
              }
              yield* Result.match(result, {
                onFailure: () =>
                  invalidate.pipe(
                    Effect.andThen(message(readFailure(undefined))),
                  ),
                onSuccess: (value) => accept(invocation, value),
              })
            }),
          ),
          Match.exhaustive,
        ),
      ),
    }
  },
)
