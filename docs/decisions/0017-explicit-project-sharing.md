# ADR 0017 — Explicit project sharing

- Status: Proposed; maintainer approval required before implementation
- Date: 2026-11-13
- Task: Access TASK-014; implementation belongs to TASK-015
- Inspected baseline: staging `683bbdc`, Better Auth 1.7.17, migrations through 0025

## Proposed first delivery

An owner invites a colleague to **one named project** as a read-only `viewer`.
One project has exactly one owner. Workspace grouping grants no authority, and
joining a project never grants its siblings or the owner's future projects.
Target small teams of roughly 2–10 people; initially cap a project at 25 members
including its owner, and 25 pending invitations. Lists use pages of at most 25.
These are proposed product limits, not measured capacity guarantees.

This viewer can read **the project's diagnostic evidence**, including reported
properties, error details and existing diagnostic downloads. Invitation creation
and acceptance must say this plainly. It is not a redacted business-reader role.
Do not claim business-safe sharing until the separate projection contract and
server enforcement exist. No customer/entity/field-specific permissions are
implied. Flowmark still observes application-owned work and never executes it.

For this first delivery ownership is **not transferable**. Owner promotion,
demotion, removal and leaving are rejected. An owner can stop sharing by removing
viewers, then use the existing sole-member deletion flow. Moving ownership to a
colleague needs a later reviewed transfer/key-rotation contract; support must not
bypass the rule with an undocumented database edit. This is an explicit proposed
narrowing of TASK-015's transfer scope, requiring maintainer acceptance.

## Provider reuse decision

Better Auth remains responsible for identity, verified addresses, passwords and
sessions. Reuse its existing native reauthentication and verified identity, plus
the existing Email delivery service. Do not enable its organization plugin.

The installed organization plugin represents organization memberships and
invitations using `organizationId`, session active-organization state and
organization roles. Its invitation path supports email matching, expiry,
conditional pending-state acceptance and an optional verified-email policy; its
member routes protect the last organization owner. Those are useful primitives
for an organization product, but they do not represent our project resource.
Using them here would require either an organization per project or a second
organization-to-project permission graph, with additional lifecycle/hook surfaces.
Renaming schema columns does not turn organization authority into project scope.

Use a small **project-domain invitation record**, not a parallel identity system.
The tradeoff is owning its one-use token, lifecycle, atomic admission and tests.
No new auth dependency, organization dashboard, active-organization session field,
provider configuration or hosted resource is selected. Provider behavior was
checked against the installed source, not inferred from current website examples.

References: [official organization documentation](https://better-auth.com/docs/plugins/organization);
installed `better-auth/dist/plugins/organization/{schema.mjs,organization.mjs}` and
`routes/{crud-invites.mjs,crud-members.mjs}` in the private auth package dependency.

## Authority matrix

The matrix describes the proposed implementation, not current enforcement.
All access also requires an active account/project and fresh authorization.
Ingestion/read keys keep their existing independent permission and project scope;
agent grants intersect current membership, project selection and live grant state.

| Operation                                                              | Owner                                                              | Viewer                                            | Stranger / pending invite            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------ |
| List accessible projects and own role                                  | Own memberships                                                    | Own memberships                                   | Own memberships only                 |
| Read runs, context, comparisons, declarations, diagnostic download     | Selected project                                                   | Selected project, full diagnostic read            | Deny                                 |
| Issue delegated read consent                                           | Current read authority only                                        | Current read authority only                       | Deny                                 |
| Save/list/delete private live selections                               | Own objects only                                                   | Own objects only                                  | Deny                                 |
| Rename project; list/create/revoke/rotate keys, including key metadata | Allow                                                              | Deny                                              | Deny                                 |
| Change declarations, search configuration or apply code imports        | Allow                                                              | Deny                                              | Deny                                 |
| Inspect private import history/receipts or mutation previews           | Allow                                                              | Deny                                              | Deny                                 |
| Create/resend/revoke invitations; list member emails; remove viewer    | Allow                                                              | Deny                                              | Deny                                 |
| Leave project                                                          | Deny as sole owner                                                 | Own membership only                               | Deny                                 |
| Promote/demote/transfer/remove owner                                   | Unsupported                                                        | Deny                                              | Deny                                 |
| Project export, telemetry erasure, project deletion                    | Existing owner rules; remove viewers first for destructive actions | Deny                                              | Deny                                 |
| Personal account export/deletion                                       | Own personal data; shared-owned projects block deletion            | Own personal data; detach viewer memberships only | Own personal data only               |
| Create a new project                                                   | Own personal creation target                                       | Own personal creation target                      | Signed-in user's own creation target |

Full personal/project exports remain future work; the matrix grants no new
export endpoint. A diagnostic download is an authorized read, not a complete
project export or proof of business correctness. Viewers never see other users'
private saved selections or account/session/recovery data. They may see the
project's owner display name for scope context, not the owner's mailbox or roster.

## Invitation and membership lifecycle

- Require a verified owner, exact reviewed browser session, trusted origin and
  native current-password confirmation for creating/resending an invitation.
  Management uses session authority only, never ingestion/read keys or agents.
  Recheck owner, project lifecycle and all bounds inside the admission transaction.
- Normalize addresses consistently with existing email auth. Invite exactly one
  address to exactly one project with the fixed viewer role. Reject own-address
  invites. Return uniform feedback for existing/new recipients; never expose
  account existence. A pending invitation is not membership.
- Store an opaque ID, project, inviter's immutable ID, normalized recipient,
  optional existing recipient user ID, token hash, state, expiry and timestamps.
  If a recipient already exists, bind its immutable ID internally without changing
  public feedback. Generate at least 256 random token bits; persist only the hash.
  Never put tokens in ordinary list responses, logs, analytics or browser storage.
- One pending invitation per project/address. Expire after 72 hours. Resending
  atomically replaces the token and deadline; previous links fail. Bound sending
  to 10 attempts per owner/project per 15 minutes, 50 per day, and 3 per recipient
  per hour, including failed submissions. Reuse durable abuse-budget patterns.
- Commit pending state before submitting captured mail outside the transaction.
  Submission failure grants nothing and remains visible as unconfirmed; retry
  rotates the token. Submission is not proof of delivery. No new queue is needed.
- A mail link opens a neutral invitation page, never accepts on GET or signs in.
  Anonymous/new recipients use normal sign-in/signup and optional verification
  flows, then return to that page. Do not weaken verification or auto-switch an
  already signed-in identity. A bare ID/token cannot reveal project/member data.
- Before revealing the project name, inviter display name and precise read scope,
  require the valid token and a currently verified matching email, plus a matching
  immutable recipient ID when present. Wrong-account feedback is generic and
  offers explicit sign-out/re-login; it must not display the target email or scope.
- Accept/decline requires an explicit same-origin POST. Acceptance atomically
  rechecks token, pending state, expiry, recipient identity, live inviter ownership,
  lifecycle and member cap, then inserts the unique membership and spends the
  token. Concurrent acceptance grants at most one membership. A replay of an
  accepted token is unavailable; signed-in members can use the normal project list.
  An already-existing membership is not duplicated or upgraded. Decline and revoke
  are terminal; expired/invalid links share neutral unavailable feedback.
- Successful recipient email changes revoke pending invitations bound to that
  user or addressed to the old verified mailbox, in the email-change transaction.
  Accepted membership stays bound to the immutable user ID. An owner's ordinary
  email change does not invalidate invitations it issued while ownership remains.
- Revoking an invitation or removing a viewer is an owner action; leaving is a
  viewer action. Recheck live membership under the project lock. Removal/leave
  deletes that user's project grant bindings and denies fresh requests immediately.
  Preserve grants to other projects. Rejoining requires a fresh invitation; old
  OAuth project consent must not silently reactivate. Existing private selections
  remain inaccessible while removed and may reopen after rejoining, per ADR 0014.
- Account deletion revokes invitations issued by or addressed to that identity
  (including unbound invitations for its current verified email). Project deletion
  revokes/deletes all its invitations. Losing inviter authority invalidates pending
  invitations even if a stale row/token survives. Keep only minimal terminal
  invitation metadata for at most seven days, with logical expiry and bounded
  traffic-driven pruning; no permanent recipient/address history.

Removal cannot erase downloaded data. A viewer has no server key issuance rights;
if anyone independently copied a project key, removal does not revoke that secret.
Show the owner's explicit revoke/rotation action and its producer impact. There is
no privileged-member removal or owner transfer in this first model; any later
version must invalidate all project keys atomically at that authority boundary.

## Creation targeting, deletion and transaction boundaries

`getWorkspaceForUser` currently selects the first membership's workspace. Replace
that creation rule before admitting viewers. Use a private, unique user-to-personal-
workspace creation mapping, allocated lazily under the user lock. Existing projects
remain in their groupings; a new home does not grant access to any grouped project.
Creating a project through an invited membership can never select the inviter's
workspace. Clean up an empty personal home on account deletion without deleting
foreign projects. Do not infer an organization's owner from workspace membership.

The conservative ADR 0015 destructive rule remains: telemetry erasure/project
removal require exactly one owner member. An owner with viewers must remove them
first; account deletion lists and blocks shared-owned projects without mutation.
Viewer account deletion must detach its memberships and revoke its grant/invite
bindings, never preview, count, fence, purge or delete the owner's projects.
Personal-data counts distinguish owned projects from memberships.

Existing `activeProjectOwners` / `lockActiveProjectOwners` currently inspect every
membership because all members are owners today. Make owner checks role-specific
and check the current reader's lifecycle independently. Deleting a viewer account
must not deny ingestion or another member's reads on the owner's project. This is
a prerequisite, not a post-invitation cleanup. Do not enable raw provider deletion
or organization routes as a second authority path.

Use existing lifecycle locks: acquire affected active user rows in stable ID order,
then project rows in stable ID order, then membership/invitation rows. Revalidate
any IDs read before locking. Coordinate invitation acceptance, email change,
removal and account/project cleanup under that order; verify against actual
existing transaction paths before finalizing TASK-015 code. No delivery/network
work holds locks. Project creation and membership mutation retain their database
lifecycle guard. Bound SQL/lock time and roll back failed admission atomically.

Keep invitation/project authorization use cases in `@flowmark/api`, native
identity/password proofs in private `@flowmark/auth`, and SQL/transaction guards in
`@flowmark/db`. HTTP/tRPC/MCP remain protocol shells. Use Effect services, typed
failures and Schema trust boundaries; no mutable invitation service or independent
permission cache. Expose current capabilities in project DTOs for UI guidance,
while rechecking the actual membership at every server/persistence boundary.

## Migration, implementation and verification handoff

1. Before adding viewers, inventory all read/mutation entry points in API, tRPC,
   HTTP, MCP, SDK reads, private selections, definitions/imports, lifecycle and
   provider boundaries. Separate diagnostic-read admission from owner-only writes
   and key metadata. Enforce at persistence transactions as well as API admission;
   hiding buttons or trusting a cached role is insufficient.
2. Add the closed owner/viewer role constraint, at-most-one-owner partial unique
   index, invitation records/indexes and personal-creation mapping through a new
   Drizzle migration. Preflight existing missing/multiple-owner or unknown-role
   data; stop with a reviewed repair requirement, never choose an arbitrary owner.
   Membership guards prevent deleting the last owner of a live project; deliberate
   project purge remains the scoped exception. Preserve existing owners and keys.
3. Deliver denial/creation/lifecycle prerequisites with tests **before** admission
   and UI. Then implement bounded captured-mail invitations, member removal/leave,
   DTO capabilities and project-scoped Settings membership UI as one TASK-015 scope.
   Do not introduce a new public task/order or enable partially enforced viewers.
4. In three synthetic accounts and two projects, walk owner/viewer/stranger;
   new/existing account; correct/wrong/unverified email; replaced/expired/declined/
   revoked/replayed invites; concurrent accept/remove/delete/email-change; cap and
   delivery failures. Verify every matrix denial directly, not through UI alone.
5. Prove a viewer creating a project uses its own home; viewer deletion leaves
   owner data/ingestion live; owner deletion blocks with viewers; invite acceptance
   invalidates a stale deletion preview; a removed session/agent cannot read even
   if admitted before removal. Rejoining must not revive old grants. Test private
   selection ownership and key-compromise warnings. Retain browser keyboard/mobile,
   denied/missing/withheld distinctions and private-cache clearing on role changes.
6. Include schema, SQL and generated metadata together. Run managed disposable
   integration, root checks and affected builds. Preview migration/smoke and normal
   reviewed rollout use the existing migration workflow; no migration on ordinary
   PR requests. Do not roll back binaries to an owner-only-assuming revision while
   viewer rows exist: that would restore management authority. Freeze access first
   and review a forward repair or explicitly approved viewer-removal recovery.

This ADR changes no runtime, schema, provider setting or hosted account. Approval
accepts the proposed first-delivery scope for local TASK-015 implementation and
disposable tests only; it does not authorize real invitations, a migration/deploy,
merge or any other hosted operation. Until approved, ADR 0015 and current owner-only
behavior remain authoritative. Restricted business projections stay with their
separate tasks; this decision neither implements nor certifies them.
