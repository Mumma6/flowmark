# ADR 0016 — Verified account email changes

- Status: Accepted for local implementation (maintainer approval, 2026-11-13)
- Date: 2026-11-13
- Scope: TASK-004 local implementation and disposable verification. No hosted
  account change, real mail, provider configuration or deployment is authorized.

## Decision

Reuse the installed Better Auth provider and existing Email service. Preserve
immutable user IDs, project ownership, passwords and project keys. This adds an
account setting, not another identity or mail system.

1. Require an active browser session, its exact reviewed identity, current
   password verification and a durable per-account attempt budget. API keys and
   delegated agent credentials cannot request or cancel changes.
2. Require the existing email to be verified before changing it. Verification
   remains optional for all ordinary product use. A change requires both native
   provider proofs: confirmation at the old address, then verification at the
   new address. Never enable update-without-verification or a legacy direct
   update path. Lost old-mailbox access has no automatic bypass; support needs
   a separately reviewed identity-recovery procedure.
3. Keep one active request per user, with a thirty-minute total deadline. A
   fresh password-confirmed request supersedes earlier requests. Cancellation
   invalidates both outstanding links and leaves the profile unchanged. Neither
   cancellation nor replacement can unsend delivered mail.
4. Bind request, old address, new address and both proof stages to the immutable
   user ID. Persist only hashed proof tokens. A link alone cannot read account
   data or sign someone in. A signed-in different account cannot use the link;
   a signed-out browser may complete both mailbox proofs without automatic login.
5. Serialize cancellation, replacement and completion under the user lock.
   Recheck current email, request version, token hash, stage, expiry and account
   deletion fence in that transaction. The provider still validates signatures
   and updates identity; competing or replayed proofs cannot overwrite a winner.
6. After completion, invalidate earlier recovery material, revoke existing
   browser sessions and delegated agent grants, and require sign-in with the new
   address. Clear the completion browser's auth cookies through the provider.
   Project ingestion/read keys remain separately managed. The old email no
   longer signs into this identity; registering it later creates a different ID.
7. Notify the old address after the profile transaction commits. Failure to send
   this notice cannot undo an already verified change or be reported as successful
   delivery. Retain a retryable notice record for at most 24 hours after completion and
   show honest feedback. Active change requests retain their thirty-minute deadline.

## Provider boundary and persistence

Better Auth 1.7.17 supports the two mailbox stages and immutable user binding.
Its signed links alone do not provide cancellation, latest-request admission or
atomic concurrency checks. Keep native change-email APIs behind the coordinated
server boundary, including direct verification of change-email tokens. Ordinary
signup verification and password recovery keep their existing routes and behavior.

Use feature-specific persistence operations in `@flowmark/db` and provider
coordination in private `@flowmark/auth`. Reuse purpose-scoped `verification` rows
for versioned pending requests and completed notice retries, including `userId`
for existing account-erasure coverage. No new table, dependency or hosted variable
is proposed. Expired records have logical expiry and bounded traffic-driven pruning.
Do not store plaintext bearer links, passwords or a permanent address history.

Run provider verification with the transaction-scoped adapter while the user and
request are locked. Capture outgoing messages during that transaction and submit
them only after commit, so network delivery never holds database locks. Roll back
provider failures and never return cookies for an uncommitted profile change.
Use the existing bounded Email transport; no queue, background Promise or mail
provider replacement. Delivery uncertainty and profile completion are distinct.

## Verification and rollout

Use disposable PostgreSQL and in-memory synthetic mail capture for both stages,
old/new login behavior, immutable ownership, duplicate addresses, cancelled,
expired, replaced and replayed tokens, concurrent completion, signed-out and
foreign-account callbacks, provider/delivery failures and account-deletion races.
Test raw endpoint bypass and old reset-token denial. Test the actual form and
public completion page, including access before project/onboarding setup,
pending/error states and cache clearing. Run root checks and affected builds.

Previously verified mail infrastructure/inbox delivery is reused. No repeat live
inbox test or hosted identity operation is needed to implement this feature.
