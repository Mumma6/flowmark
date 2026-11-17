import { Code2, Radio, Workflow } from "lucide-react"
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
    icon: Code2,
    description:
      "Recommended: let Cursor investigate Flowmark evidence alongside your code. Add the configuration, sign in and approve this project.",
    note: "Cursor is optional.",
    detail:
      "Continue to instrumentation to use Cursor or follow the manual SDK steps. You can connect later from Connect in Studio.",
  },
  instrument: {
    icon: Workflow,
    description:
      "Save your application key, then give Cursor the prompt below. It will inspect your code and help you instrument one useful process. Manual SDK steps are available alongside it.",
    note: "One process, one useful result.",
    detail:
      "Capture a result your application already knows, such as imported and skipped counts. Cursor edits the code; the SDK sends evidence; MCP reads it.",
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
