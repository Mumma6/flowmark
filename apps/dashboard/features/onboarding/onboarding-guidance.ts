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
      "Copy a setup prompt for your AI agent, or follow the manual SDK instructions. You can reopen these instructions from Studio whenever you need them.",
    note: "Continue to Studio whenever you're ready.",
    detail:
      "Install, deploy and run your application on your own schedule. Evidence appears in Studio when your application sends it.",
  },
} as const
