"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Result } from "effect"
import { useState } from "react"
import { useTRPC } from "../../platform/api-trpc"
import { decodeDefinitionDocument } from "./definition-document"

export function useDefinitionImport(projectId: string, workflow?: string) {
  const trpc = useTRPC()
  const cache = useQueryClient()
  const [document, setDocument] = useState("")
  const [validation, setValidation] = useState("")
  const preview = useMutation(
    trpc.resultDeclarations.previewImport.mutationOptions(),
  )
  const apply = useMutation(
    trpc.resultDeclarations.applyImport.mutationOptions({
      onSuccess: () => {
        void cache.invalidateQueries()
      },
    }),
  )
  const busy = preview.isPending || apply.isPending
  const update = (value: string) => {
    if (busy) {
      return
    }
    setDocument(value)
    setValidation("")
    preview.reset()
    apply.reset()
  }
  const review = () => {
    if (busy) {
      return
    }
    setValidation("")
    apply.reset()
    Result.match(decodeDefinitionDocument(document), {
      onFailure: () =>
        setValidation(
          "Enter valid definition JSON using version 1 and the existing result/search field limits. Unknown properties are not accepted.",
        ),
      onSuccess: (definition) => {
        if (workflow && definition.workflow !== workflow) {
          setValidation(
            `This configuration belongs to ${workflow}. Choose that workflow in the document or import another workflow from Settings.`,
          )
          return
        }
        preview.mutate({ projectId, definition })
      },
    })
  }
  const commit = () => {
    if (
      busy ||
      !preview.data ||
      !preview.variables ||
      preview.data.status !== "Reviewable"
    ) {
      return
    }
    apply.mutate({
      projectId,
      command: {
        definition: preview.variables.definition,
        manifestFingerprint: preview.data.manifestFingerprint,
        baseFingerprint: preview.data.baseFingerprint,
      },
    })
  }
  return { document, validation, update, review, commit, preview, apply, busy }
}
