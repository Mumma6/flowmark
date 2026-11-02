export const PROJECT_STORAGE_KEY = "flowmark.projectId"

export function readStoredProjectId() {
  return typeof window === "undefined"
    ? null
    : window.localStorage.getItem(PROJECT_STORAGE_KEY)
}

export function storeProjectId(projectId: string) {
  window.localStorage.setItem(PROJECT_STORAGE_KEY, projectId)
}
