import { KeyRound, Radio, Workflow } from "lucide-react"
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
      "Copy the setup prompt into your AI agent. It reads the SDK documentation, installs the SDK and helps instrument one useful process. You can also follow the manual SDK steps.",
    note: "One process, one useful result.",
    detail:
      "Capture a result your application already knows, such as imported and skipped counts. Your AI agent writes the instrumentation code; the SDK sends evidence when your application runs.",
  },
  run: {
    icon: Radio,
    description:
      "Run the process in your application, then check for its execution here.",
    note: "Read the result, then follow the evidence.",
    detail:
      "Completion means the application reported completion. Check the reported result for skipped or rejected work, then inspect operations and failures.",
  },
} as const
