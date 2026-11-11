import { Code2, KeyRound, Radio, Workflow } from "lucide-react"
export const guidance = {
  project: {
    icon: Workflow,
    description:
      "Give your application a home. A project keeps its evidence, access and ingestion keys together.",
    note: "One application, one context.",
    detail:
      "You can create more projects later. Start with the application and environment you want to understand first.",
  },
  key: {
    icon: KeyRound,
    description:
      "Save the credential your application uses to send evidence. Your Studio account and your write key have different jobs.",
    note: "Your key stays on your server.",
    detail:
      "Store it in your application's server environment. Keep it out of browser bundles, Git, agent prompts and chat messages.",
  },
  install: {
    icon: Code2,
    description:
      "Add the TypeScript SDK to the application you already own. Keep your runtime, framework and business logic.",
    note: "Built around your application.",
    detail:
      "Use the Node client for workers and servers, or the Next.js adapter for request-lifecycle delivery. The API URL is the origin, without /v1/events.",
  },
  instrument: {
    icon: Workflow,
    description:
      "Choose one process worth understanding. Use your coding agent to add meaningful context and reported outcomes.",
    note: "Give the agent guidance, not secrets.",
    detail:
      "These instructions work with Codex, Cursor, Claude Code or your coding agent. Copying a prompt does not connect or authorize an agent.",
  },
  run: {
    icon: Radio,
    description:
      "Run your application normally, then follow the execution evidence into Studio.",
    note: "Completion is one piece of evidence.",
    detail:
      "Reported results and expected confirmations tell you more. A completed execution does not prove every record succeeded.",
  },
} as const
