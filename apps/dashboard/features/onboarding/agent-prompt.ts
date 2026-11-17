export function instrumentationGuideUrl(apiOrigin: string): string {
  return `${apiOrigin}/v1/instrumentation`
}

/** Public documentation and project context only. Never include credentials. */
export function flowmarkAgentPrompt(
  apiOrigin: string,
  project?: { readonly id: string; readonly name: string } | null,
): string {
  return [
    `Fetch and follow ${instrumentationGuideUrl(apiOrigin)} to help me install Flowmark in this repository.`,
    ...(project
      ? [
          `Flowmark project: ${JSON.stringify(project.name)} (project ID: ${project.id}).`,
        ]
      : []),
    "Use that versioned guide for the first integration. Read linked references or the installed package README/types only when a specific question remains; do not inspect compiled implementation to guess APIs. If the guide is unavailable, stop and tell me.",
    "1. Inspect the repository, framework, package manager and existing telemetry. Suggest one useful process (for example an import, checkout or background job), explain what we will learn, and keep the first change small.",
    "2. Install @flowmarkdev/node with this repo's package manager. Next.js Route Handlers and Server Actions use a shared @flowmarkdev/node/next client with automatic delivery. Standalone scripts and workers create their own @flowmarkdev/node client and own shutdown. Shared business logic accepts a Flow or narrow client dependency; choose the adapter at each entry point instead of guessing the runtime through exceptions or maintaining fallback clients. Ask me to put the project write key in the server environment myself; never read, print, commit or request the key in chat.",
    `Use FLOWMARK_API_URL=${apiOrigin}. Keep all server credentials out of browser bundles and prompts.`,
    "3. Use the workflow lifecycle supported by the installed SDK version: the callback form for a process that finishes in one invocation when available, or manual workflow()/done()/fail() markers for a continuation. Use step() for milestones and operation() for measured work. Report a meaningful business outcome and small result the application already knows, including imported, skipped or rejected counts and partial results where applicable. Preserve return values, original errors and existing execution/retry behavior. Handle telemetry delivery separately at the documented runtime boundary; configuration errors must remain visible.",
    "4. Run the relevant local checks. If an existing test or safe application action runs the actual instrumented process, explain how I can use it to check delivery. Do not create artificial executions or add verification APIs. Do not run destructive or external business actions without asking. If this process cannot safely run now, explain what was checked locally and leave delivery unverified; I can deploy and wait for real activity.",
    "5. When a real execution has been reported, guide me to this project in Flowmark Studio. Select the instrumented process in Explore, open its execution, and check the reported result, operations and failures. If no execution appears, check the application configuration and documented SDK delivery diagnostics. A successful install alone does not verify that evidence arrived.",
    "You edit this repository using your normal coding tools. The SDK sends telemetry when the application runs. Completion is application-reported, not verified business success; missing terminal telemetry does not prove activity or failure. Do not add advanced declarations, relationships or expectations unless this first process needs them.",
  ].join("\n\n")
}
