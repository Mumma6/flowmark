import { Effect } from "effect"
import { getOrCreatePersonalWorkspace } from "./get-or-create-personal-workspace.js"
import { createProject } from "./create-project.js"

export const createOwnedProject = Effect.fn("createOwnedProject")(function* (
  userId: string,
  names: { readonly workspace: string; readonly project: string },
) {
  const workspaceId = yield* getOrCreatePersonalWorkspace(userId)
  return yield* createProject(userId, workspaceId, names.project)
})
