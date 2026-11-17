export function instrumentationGuideUrl(apiOrigin: string): string {
  return `${apiOrigin}/v1/instrumentation`
}

/** Public documentation and project context only. Never include credentials. */
export function flowmarkAgentPrompt(
  apiOrigin: string,
  project?: { readonly id: string; readonly name: string } | null,
): string {
  return [
    "Help me instrument one meaningful process in this application with Flowmark.",
    ...(project
      ? [
          `Flowmark project: ${JSON.stringify(project.name)} (project ID: ${project.id}).`,
        ]
      : []),
    `Fetch and follow ${instrumentationGuideUrl(apiOrigin)}. Read the actual @flowmarkdev/node README and the SDK documentation it references before choosing APIs. If you cannot read the docs, stop and tell me; do not invent APIs.`,
    "1. Inspect the repository, framework, package manager and existing telemetry. Suggest one useful process (for example an import, checkout or background job), explain what we will learn, and keep the first change small.",
    "2. Install @flowmarkdev/node with this repo's package manager and create one shared client using the documented Node or Next.js entry point. Ask me to put the project write key in the server environment myself; never read, print, commit or request the key in chat.",
    `Use FLOWMARK_API_URL=${apiOrigin}. Keep all server credentials out of browser bundles and prompts.`,
    "3. Add a workflow run around existing work, a few useful milestones or operations, and explicit completion/failure markers. Report a small business result the application already knows, such as imported, skipped or rejected counts. Preserve return values, original errors and existing execution/retry behavior. Handle telemetry delivery separately at the documented runtime boundary.",
    "4. Run the relevant local checks. Tell me how to trigger this process safely with my existing test data. Do not run destructive or external business actions without asking.",
    "5. After I run it, verify the evidence. If Flowmark MCP is connected, call get_connection, select the project above (ask if ambiguous), then list_workflows, find_runs within the execution's explicit UTC window (at most 31 days), and get_run for the matching execution. Inspect its reported outcome, result and operations; return the Studio link. An empty history is a valid connection check, not proof of instrumentation. If MCP is unavailable, guide me to the same project and process in Studio.",
    "MCP gives you read access to Flowmark evidence. You edit this repository using Cursor's coding tools; the SDK sends telemetry. MCP itself does not modify code or run the application. Completion is application-reported, not verified business success; missing terminal telemetry does not prove activity or failure. Do not add advanced declarations, relationships or expectations unless this first process needs them.",
  ].join("\n\n")
}
