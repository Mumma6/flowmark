"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Array as EffectArray } from "effect"
import { useTRPC } from "../platform/api-trpc"
import { readStoredProjectId, storeProjectId } from "./project-selection"

type Project = {
  readonly role?: "owner" | "viewer"
  readonly id: string
  readonly name: string
  readonly createdAt: string
}

type ProjectContextValue = {
  readonly projects: readonly Project[]
  readonly current: Project | null
  readonly pending: boolean
  readonly error: { readonly message: string } | null
  readonly retry: () => void
  readonly select: (projectId: string) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const list = useQuery(trpc.project.list.queryOptions())
  const previousProjects = useRef<readonly Project[] | undefined>(undefined)
  useEffect(() => {
    const currentProjects = list.data
    if (!currentProjects || list.isFetching || list.isError) {
      return
    }
    const before = previousProjects.current
    previousProjects.current = currentProjects
    if (
      before &&
      EffectArray.some(
        before,
        (project) =>
          !EffectArray.some(
            currentProjects,
            (next) => next.id === project.id && next.role === project.role,
          ),
      )
    ) {
      queryClient.removeQueries({
        predicate: (query) => {
          const path = query.queryKey[0]
          return !(Array.isArray(path) && path.join(".") === "project.list")
        },
      })
    }
  }, [list.data, list.isFetching, list.isError, queryClient])
  const [selectedId, setSelectedId] = useState<string | null>(
    readStoredProjectId,
  )

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
      error: list.error,
      retry: () => void list.refetch(),
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
  }, [
    list.data,
    list.isPending,
    list.error,
    list.refetch,
    queryClient,
    selectedId,
  ])

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
