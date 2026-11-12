import {
  DefinitionImportSchema,
  type DefinitionImportPreview,
  type ResultDeclaration,
} from "@flowmarkdev/core"
import { Array, Match, Option, Schema, pipe } from "effect"

export const decodeDefinitionDocument = Schema.decodeUnknownResult(
  Schema.fromJsonString(DefinitionImportSchema),
  { onExcessProperty: "error" },
)

export const definitionResultActionLabel = (
  action: DefinitionImportPreview["result"]["action"],
) =>
  Match.value(action).pipe(
    Match.when("NotRequested", () => "Not included in this document"),
    Match.when("Create", () => "New immutable revision"),
    Match.when("Unchanged", () => "Already configured; ownership preserved"),
    Match.when("Conflict", () => "Different meaning is already stored"),
    Match.exhaustive,
  )

export const definitionFieldDescription = (
  field: ResultDeclaration["fields"][number],
) =>
  pipe(
    [
      Option.some(field.label),
      Option.some(`Path: ${JSON.stringify(field.path)}`),
      Option.some(field.kind),
      Option.some(field.aggregate ? "Aggregation enabled" : "Display only"),
      Option.fromUndefinedOr(field.unit).pipe(
        Option.map((unit) => `Unit: ${unit}`),
      ),
      Option.fromUndefinedOr(field.values).pipe(
        Option.map((values) => `Values: ${Array.join(values, ", ")}`),
      ),
    ],
    Array.getSomes,
    Array.join(" · "),
  )
