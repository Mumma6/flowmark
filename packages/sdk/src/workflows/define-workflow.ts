import type {
  Flow,
  FlowmarkClient,
  WorkflowDefinition,
  WorkflowRunOptions,
} from "../types/index.js"
import type { WorkflowName } from "@flowmarkdev/core"
import { withCallbackLifecycle } from "../utils/callback-lifecycle.js"

/** Shared public callback/definition API over a runtime-specific start boundary. */
export function withWorkflowDefinitions<Client>(
  client: Client & {
    readonly workflow: (
      name: WorkflowName,
      options?: WorkflowRunOptions,
    ) => Flow
  },
): Client & Pick<FlowmarkClient, "workflow" | "defineWorkflow"> {
  function workflow(name: WorkflowName, options?: WorkflowRunOptions): Flow
  function workflow<Value>(
    name: WorkflowName,
    callback: (flow: Flow) => Value | PromiseLike<Value>,
    options?: WorkflowRunOptions,
  ): Promise<Value>
  function workflow<Value>(
    name: WorkflowName,
    callbackOrOptions?:
      WorkflowRunOptions | ((flow: Flow) => Value | PromiseLike<Value>),
    options?: WorkflowRunOptions,
  ): Flow | Promise<Value> {
    if (typeof callbackOrOptions !== "function") {
      return client.workflow(name, callbackOrOptions)
    }
    const flow = client.workflow(name, options)
    return withCallbackLifecycle(
      flow,
      () => callbackOrOptions(flow),
      () => flow.fail({ code: "workflow_failed" }),
    )
  }
  return {
    ...client,
    workflow,
    defineWorkflow: <
      Context extends object,
      Result extends object,
      Outcome extends string = string,
    >(
      name: string,
    ) =>
      ({
        start: <Value>(
          callbackOrOptions?:
            WorkflowRunOptions | ((flow: Flow) => Value | PromiseLike<Value>),
          options?: WorkflowRunOptions,
        ) =>
          typeof callbackOrOptions === "function"
            ? workflow(name, callbackOrOptions, options)
            : workflow(name, callbackOrOptions),
      }) as unknown as WorkflowDefinition<Context, Result, Outcome>,
  }
}
