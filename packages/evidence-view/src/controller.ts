import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as Queue from "effect/Queue"
import {
  EvidenceReadError,
  EvidenceChannelOverloaded,
  readFailure,
  type EvidenceAction,
  type EvidenceViewState,
} from "./lifecycle.js"
import {
  EvidenceReader,
  makeEvidenceSession,
  type EvidenceEvent,
} from "./session.js"

export type { EvidenceViewState } from "./lifecycle.js"
type HostEvent =
  EvidenceEvent | { readonly _tag: "Theme"; readonly theme?: string }

/** SDK/React boundary. One scope owns the channel, observers and all read fibers. */
export const runEvidenceView = Effect.fn("EvidenceView.run")(
  (
    app: App,
    transport: PostMessageTransport,
    render: (state: EvidenceViewState) => void,
    theme: (value: "light" | "dark") => void,
    actions: (navigate: (action: EvidenceAction) => void) => void,
  ) =>
    Effect.scoped(
      Effect.gen(function* () {
        const events = yield* Queue.make<HostEvent, EvidenceChannelOverloaded>({
          capacity: 64,
          strategy: "dropping",
        })
        const send = (event: HostEvent) => {
          if (!Queue.offerUnsafe(events, event)) {
            // Never drop an input/result boundary and then interpret a later result.
            Queue.failCauseUnsafe(
              events,
              Cause.fail(new EvidenceChannelOverloaded()),
            )
            Queue.shutdownUnsafe(events)
          }
        }
        const session = yield* makeEvidenceSession(render, (event) =>
          Queue.offer(events, event),
        )
        const applyTheme = (value?: string) =>
          Effect.sync(() => {
            if (value === "light" || value === "dark") {
              theme(value)
            }
          })
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            // Register before connecting. SDK validates message source and protocol envelopes.
            app.ontoolinput = ({ arguments: args }) =>
              send({ _tag: "Input", args })
            app.ontoolresult = (result) => send({ _tag: "Result", result })
            app.ontoolcancelled = () =>
              send({
                _tag: "Clear",
                state: {
                  kind: "message",
                  status: "unavailable",
                  message:
                    "The evidence read was cancelled. Previous evidence and actions have been cleared.",
                },
              })
            app.onhostcontextchanged = (context) =>
              send({ _tag: "Theme", theme: context.theme })
            app.onerror = () =>
              send({
                _tag: "Clear",
                state: {
                  kind: "message",
                  status: "invalid",
                  message:
                    "Invalid host message. Use the host's complete structured/text result. Previous evidence and actions have been cleared.",
                },
              })
            app.onclose = () => send({ _tag: "Close" })
            app.onteardown = () => {
              send({ _tag: "Close" })
              return {}
            }
            actions((action) => send({ _tag: "Action", action }))
          }),
          () =>
            Effect.gen(function* () {
              yield* Queue.shutdown(events)
              // Give the SDK a turn to send its teardown response before closing the channel.
              yield* Effect.sleep(0)
              yield* Effect.promise(() => transport.close())
            }),
        )
        yield* Effect.tryPromise({
          try: () => app.connect(transport),
          catch: (cause) =>
            new EvidenceReadError({ operation: "connect", cause }),
        }).pipe(
          Effect.match({
            onFailure: () =>
              send({ _tag: "Clear", state: readFailure(undefined) }),
            onSuccess: () =>
              send({
                _tag: "Connected",
                canRead: app.getHostCapabilities()?.serverTools !== undefined,
              }),
          }),
          Effect.forkScoped,
        )

        yield* Effect.forever(
          Queue.take(events).pipe(
            Effect.andThen((event) =>
              Match.value(event).pipe(
                Match.tag("Theme", (context) => applyTheme(context.theme)),
                Match.tag("Connected", (connected) =>
                  Effect.gen(function* () {
                    yield* applyTheme(app.getHostContext()?.theme)
                    yield* Effect.acquireRelease(
                      Effect.sync(() => app.setupSizeChangedNotifications()),
                      (cleanup) => Effect.sync(cleanup),
                    )
                    yield* session.handle(connected)
                  }),
                ),
                Match.orElse(session.handle),
              ),
            ),
          ),
        ).pipe(
          Effect.catchTag("EvidenceChannelOverloaded", () =>
            Effect.sync(() =>
              render({
                kind: "message",
                status: "invalid",
                message:
                  "Too many pending host messages. The view has closed; select fresh evidence in the host. Previous evidence and actions have been cleared.",
              }),
            ),
          ),
        )
      }),
    ).pipe(
      Effect.provideService(EvidenceReader, {
        read: Effect.fn("EvidenceHost.read")((invocation) =>
          Effect.tryPromise({
            try: (signal) =>
              app.callServerTool(
                { name: "get_run", arguments: invocation },
                { signal },
              ),
            catch: (cause) =>
              new EvidenceReadError({ operation: "read", cause }),
          }),
        ),
      }),
    ),
)
