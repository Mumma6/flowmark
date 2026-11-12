"use client"

import { useState } from "react"
import { blankField, buildDeclaration, type Field } from "./declaration-form"
import { useCreateDeclaration, useResultDeclarations } from "../queries"

export function useResultDeclarationForm({
  workflow,
  projectId,
}: {
  workflow: string
  projectId: string
}) {
  const [revision, setRevision] = useState("")
  const [fields, setFields] = useState<Field[]>([])
  const [validation, setValidation] = useState("")
  const declarations = useResultDeclarations(projectId, workflow)
  const create = useCreateDeclaration(() =>
    setValidation("Saved immutable revision."),
  )
  const updateField = (index: number, change: Partial<Field>) =>
    setFields((items) =>
      items.map((item, i) => (i === index ? { ...item, ...change } : item)),
    )
  const submit = () => {
    const declaration = buildDeclaration(revision, fields)
    setValidation("")
    create.mutate({ projectId, workflow, declaration })
  }
  const addField = () => setFields((items) => [...items, blankField()])
  const removeField = (index: number) =>
    setFields((items) => items.filter((_, i) => i !== index))
  return {
    revision,
    setRevision,
    fields,
    addField,
    removeField,
    submit,
    validation,

    declarations,
    create,
    updateField,
  }
}
