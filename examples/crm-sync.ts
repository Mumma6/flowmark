import { flowmark } from "./flowmark"

declare function pushAccount(accountId: string): Promise<void>

/**
 * The application decides whether to try again. `attempt` only labels
 * what already happened. `mapError` selects safe `code`, `message` and
 * `retryable` fields instead of the generic default failure code.
 */
export async function syncAccount(accountId: string): Promise<void> {
  const flow = flowmark.workflow("crm.account-sync", {
    properties: { accountId },
  })
  const groupId = `account-${accountId}`

  for (const number of [1, 2]) {
    try {
      await flow.operation("push-account", () => pushAccount(accountId), {
        attempt: { groupId, number },
        mapError: () => ({
          code: "CRM_UNAVAILABLE",
          message: "CRM temporarily unavailable",
          retryable: number < 2,
        }),
      })
      flow.done({ outcome: "synced", result: { attempts: number } })
      return
    } catch (cause) {
      if (number === 2) {
        flow.fail({
          code: "CRM_UNAVAILABLE",
          outcome: "unsynced",
          result: { attempts: number },
        })
        throw cause
      }
    }
  }
}
