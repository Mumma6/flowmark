import type {
  FlowmarkClient,
  WorkflowDefinition,
  WorkflowRunOptions,
} from "../../types/index.js"

/** Pure static view over the runtime-specific start boundary. No resources or events. */
export function withWorkflowDefinitions<
  Client extends Pick<FlowmarkClient, "workflow">,
>(client: Client): Client & Pick<FlowmarkClient, "defineWorkflow"> {
  return {
    ...client,
    defineWorkflow: <
      Context extends object,
      Result extends object,
      Outcome extends string = string,
    >(
      name: string,
    ) =>
      ({
        start: (options?: WorkflowRunOptions) => client.workflow(name, options),
      }) as unknown as WorkflowDefinition<Context, Result, Outcome>,
  }
}
