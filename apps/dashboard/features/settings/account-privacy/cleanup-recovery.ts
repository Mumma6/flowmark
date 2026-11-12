import { Result, Schema } from "effect"

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const Id = Schema.String.check(Schema.isPattern(new RegExp(`^${uuid}$`, "i")))
const Capability = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/))
const Recovery = Schema.Struct({
  operationId: Id,
  capability: Capability,
  confirmed: Schema.Boolean,
})
export type CleanupRecovery = typeof Recovery.Type
const StoredRecovery = Schema.fromJsonString(Recovery)
const storageKey = "flowmark.account-cleanup.v1"

export const readCleanupRecovery = () =>
  Result.try(() => window.sessionStorage.getItem(storageKey)).pipe(
    Result.flatMap((value) =>
      value === null
        ? Result.succeed(null)
        : Schema.decodeUnknownResult(StoredRecovery, {
            onExcessProperty: "error",
          })(value),
    ),
  )
export const saveCleanupRecovery = (value: CleanupRecovery) =>
  Result.try(() =>
    window.sessionStorage.setItem(storageKey, JSON.stringify(value)),
  )
export const removeCleanupRecovery = () =>
  Result.try(() => window.sessionStorage.removeItem(storageKey))
export const cleanupRecoveryCode = (value: CleanupRecovery) =>
  `${value.operationId}:${value.capability}`
const Code = Schema.String.check(
  Schema.isPattern(new RegExp(`^${uuid}:[A-Za-z0-9_-]{43}$`, "i")),
)
export const parseCleanupRecoveryCode = (value: string) =>
  Schema.decodeUnknownResult(Code)(value.trim()).pipe(
    Result.map((code): CleanupRecovery => ({
      operationId: code.slice(0, 36),
      capability: code.slice(37),
      confirmed: true,
    })),
  )

export const cleanupAccessInput = ({
  operationId,
  capability,
}: CleanupRecovery) => ({ operationId, capability })
