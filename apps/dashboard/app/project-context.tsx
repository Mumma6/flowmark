"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "../lib/trpc"

export const PROJECT_STORAGE_KEY = "flowmark.projectId"

export function readStoredProjectId() {
  if (typeof window === "undefined") {
    return null
  }
  return window.localStorage.getItem(PROJECT_STORAGE_KEY)
}

export function storeProjectId(projectId: string) {
  window.localStorage.setItem(PROJECT_STORAGE_KEY, projectId)
}

type Project = {
  readonly id: string
  readonly name: string
  readonly createdAt: string
}

type ProjectContextValue = {
  readonly projects: readonly Project[]
  readonly current: Project | null
  readonly pending: boolean
  readonly select: (projectId: string) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const list = useQuery(trpc.project.list.queryOptions())
  const [selectedId, setSelectedId] = useState<string | null>(readStoredProjectId)

  useEffect(() => {
    const projects = list.data
    if (!projects?.length) {
      return
    }
    if (selectedId && projects.some((project) => project.id === selectedId)) {
      return
    }
    if (selectedId && list.isFetching) {
      return
    }
    const next = projects[0]?.id ?? null
    if (next && next !== selectedId) {
      storeProjectId(next)
      setSelectedId(next)
    }
  }, [list.data, list.isFetching, selectedId])

  const value = useMemo<ProjectContextValue>(() => {
    const projects = list.data ?? []
    return {
      projects,
      current: projects.find((project) => project.id === selectedId) ?? null,
      pending: list.isPending,
      select: (projectId: string) => {
        storeProjectId(projectId)
        setSelectedId(projectId)
        queryClient.removeQueries({
          predicate: (query) => {
            const path = query.queryKey[0]
            return !(Array.isArray(path) && path.join(".") === "project.list")
          },
        })
        void queryClient.invalidateQueries()
      },
    }
  }, [list.data, list.isPending, queryClient, selectedId])

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error("useProject must be used within ProjectProvider")
  }
  return context
}
