"use client"

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import { type FormEvent } from "react"
import { CreateProjectForm } from "../projects/create-project-form"
import { useProjectSettings } from "./use-project-settings"

export function ProjectSettings() {
  const { current, projects, select, name, setName, rename } =
    useProjectSettings()
  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create your first project</CardTitle>
          <CardDescription>
            Sign-up only creates your account. A project is where runs and
            ingestion keys live — create one when you are ready to instrument an
            app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateProjectForm />
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Current project</CardTitle>
          <CardDescription>
            A project name is a label for its runs and keys. It does not limit
            which environment an application can report. Reported environment is
            telemetry, not a permission boundary. Switch projects in the
            sidebar, or create another for a second application.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {projects.length > 1 ? (
            <div className="grid max-w-md gap-2 text-sm">
              <label htmlFor="active-project" className="font-medium">
                Active project
              </label>
              <Select
                items={Object.fromEntries(
                  projects.map((project) => [project.id, project.name]),
                )}
                value={current?.id}
                onValueChange={select}
              >
                <SelectTrigger id="active-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {current ? (
            <form
              className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
              onSubmit={(event: FormEvent) => {
                event.preventDefault()
                rename.mutate({
                  projectId: current.id,
                  name,
                })
              }}
            >
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Name</span>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  required
                />
              </label>
              <Button type="submit" disabled={rename.isPending}>
                Save name
              </Button>
            </form>
          ) : null}
          {rename.error ? (
            <Alert variant="destructive">
              <AlertDescription>{rename.error.message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add another project</CardTitle>
          <CardDescription>
            Use a separate project per application. Each project gets its own
            write key. Naming a project after an environment does not enforce
            that environment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateProjectForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your projects</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">
                    {project.name}
                    {project.id === current?.id ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (current)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {project.createdAt.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    {project.id !== current?.id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => select(project.id)}
                      >
                        Switch
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
