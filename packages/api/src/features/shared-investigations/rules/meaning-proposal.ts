import { Effect } from "effect"
import type { MeaningProposal } from "@flowmarkdev/core"
import { InvalidInput } from "../../../errors.js"
import {
  decodePublication,
  publicationMeaning,
  samePath,
} from "../../business-evidence/rules/publication.js"
import { projectBusinessFields } from "../../business-evidence/rules/project-run.js"
import type { SharedQuestionAccess } from "../ports/shared-investigations.js"

export const unavailableProposal = () =>
  new InvalidInput({
    cause: "This proposal or its published example is unavailable.",
  })

export const inspectProposalExample = Effect.fn("inspectProposalExample")(
  function* (access: SharedQuestionAccess, command: MeaningProposal) {
    const run = yield* access.proposalExample(command.runId)
    if (!run || !run.definitionRevision) {
      return yield* unavailableProposal()
    }
    const choices = yield* access.choices()
    const meaning = publicationMeaning(
      yield* decodePublication(access.publication),
      choices,
    )
    const field = projectBusinessFields(run, meaning).find(
      (entry) =>
        entry.state === "available" && samePath(entry.path, command.path),
    )
    const declaration = choices.declarations.find(
      (entry) =>
        entry.workflow === run.workflow &&
        entry.declaration.revision === run.definitionRevision,
    )
    const head = yield* access.proposalHead(run.workflow)
    if (!field || !declaration || !head) {
      return yield* unavailableProposal()
    }
    return {
      workflow: run.workflow,
      revision: run.definitionRevision,
      headRevision: head.revision,
      codeOwned: head.source !== null,
      field,
    }
  },
)

export const sameMeaningProposal = (
  left: MeaningProposal,
  right: MeaningProposal,
) =>
  left.id === right.id &&
  left.runId === right.runId &&
  left.label === right.label &&
  left.reason === right.reason &&
  samePath(left.path, right.path)
