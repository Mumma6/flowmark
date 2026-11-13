# Project sharing

Open **Settings → Project access** to invite a colleague by email. Confirm your
password and acknowledge that viewers can read the project's full diagnostic
evidence, including reported properties, errors, downloads and results. Invite
only people who should see that information.

Invitations last 72 hours. The recipient signs in (or creates an account), verifies
the invited email address, reviews the project and explicitly accepts or declines.
Opening the link grants no access. Use a different account if the signed-in email
does not match. Resending replaces the previous link; revoking cancels a pending
invitation. A mail submission error leaves the invitation pending so the owner can
retry. Submission does not guarantee delivery.

Each project has one fixed owner. Viewers can investigate evidence and save their
own private selections. They cannot manage keys, rename the project, edit result
definitions, import declarations, invite others or erase project data. A viewer's
new projects belong to their own personal workspace. Ownership transfer and
additional roles are unavailable.

Owners can remove viewers; viewers can leave through Project access. Removal
revokes project access for current sessions and removes its delegated agent grant
bindings. Rejoining requires another invitation and does not restore old agent
grants. Other projects remain accessible. Private saved selections remain personal;
access to their evidence still requires current project membership.

Copied API keys are separate credentials: removing a member does not rotate them.
Revoke or rotate any keys that person obtained separately when needed.

Remove all viewers before erasing a project or deleting its owner's account.
Deleting a viewer's account removes its memberships and personal data without
erasing the owner's project. Pending invitations do not grant membership.

## Deployment

Migration 0027 adds invitations, the personal creation mapping and database guards
for fixed ownership. It aborts if existing projects have missing, duplicate or
unknown ownership; investigate that data before retrying. Apply through the normal
[database rollout](migrations.md). Do not roll back to a binary that treats every
member as an owner while viewer memberships exist. Use a reviewed forward fix or
an explicitly approved recovery plan.
