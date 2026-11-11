import { createHash } from "node:crypto"
import { Option } from "effect"
import {
  canonicalResultDeclaration,
  canonicalSearchFields,
  previewDefinitionImport,
  type DefinitionImport,
  type DefinitionImportSnapshot,
} from "@flowmarkdev/core"

const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex")

/** Review identities, never capabilities or a substitute for an apply transaction. */
export const importPreview = (
  projectId: string,
  input: DefinitionImport,
  snapshot: DefinitionImportSnapshot,
) => {
  const identity = {
    version: input.version,
    projectId,
    source: input.source,
    workflow: input.workflow,
  }
  return {
    ...identity,
    manifestFingerprint: fingerprint({
      ...identity,
      result: input.result ? canonicalResultDeclaration(input.result) : null,
      searchFields:
        input.searchFields === undefined
          ? null
          : canonicalSearchFields(input.searchFields),
    }),
    baseFingerprint: fingerprint({
      ...identity,
      requestedRevision: input.result?.revision ?? null,
      result: Option.match(snapshot.result, {
        onNone: () => null,
        onSome: canonicalResultDeclaration,
      }),
      searchFields: canonicalSearchFields(snapshot.searchFields),
    }),
    ...previewDefinitionImport(input, snapshot),
  }
}

export type ImportPreview = ReturnType<typeof importPreview>
