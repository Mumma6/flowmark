import { KeyRound, Workflow } from "lucide-react"
export const guidance = {
  project: {
    icon: Workflow,
    description:
      "Start with the application you want to understand. A project keeps its process evidence and access together.",
    note: "Start small.",
    detail:
      "Name your project after your application. You can create more projects later.",
  },
  key: {
    icon: KeyRound,
    description:
      "Your project includes a server write key. Save it for the application that will send evidence to Flowmark.",
    note: "Keep the key in your server environment.",
    detail:
      "The full value is shown only once. Keep it out of browser code, source control and AI chats. You can create another here if needed.",
  },
  instrument: {
    icon: Workflow,
    description:
      "Wrap an existing invoice import or another process with one SDK call. A coding agent can help with the same setup.",
    note: "Continue to Studio whenever you're ready.",
    detail:
      "Run an existing safe application path to check delivery, or open Studio and wait for normal traffic.",
  },
} as const
