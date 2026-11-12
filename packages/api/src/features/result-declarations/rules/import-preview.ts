import { createHash } from "node:crypto"
import {
  definitionImportReviewContent,
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
  const content = definitionImportReviewContent(projectId, input, snapshot)
  return {
    ...content.identity,
    manifestFingerprint: fingerprint(content.manifest),
    baseFingerprint: fingerprint(content.base),
    ...previewDefinitionImport(input, snapshot),
  }
}

export type ImportPreview = ReturnType<typeof importPreview>
