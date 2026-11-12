import { investigationsRouter } from "./investigations-router"
import { dataLifecycleRouter } from "./data-lifecycle-router"
import { t } from "./context"
import { healthRouter } from "./health-router"
import { projectRouter } from "./project-router"
import { onboardingRouter } from "./onboarding-router"
import { agentAccessRouter } from "./agent-access-router"
import { resultDeclarationsRouter } from "./result-declarations-router"
import { workflowRouter } from "./workflow-router"
import { searchRouter } from "./search-router"
import { runRouter } from "./run-router"

export const appRouter = t.router({
  dataLifecycle: dataLifecycleRouter,
  investigations: investigationsRouter,
  health: healthRouter,
  project: projectRouter,
  onboarding: onboardingRouter,
  agentAccess: agentAccessRouter,
  resultDeclarations: resultDeclarationsRouter,
  workflow: workflowRouter,
  search: searchRouter,
  run: runRouter,
})

export type AppRouter = typeof appRouter
