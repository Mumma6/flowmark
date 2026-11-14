# Change an account email address

Open **Settings → Account**, or `/account` before creating a project. Changing
an email requires the current password and access to both inboxes. Verify the
current address first; losing access to it does not enable an automatic bypass.

1. Enter the new address twice and confirm the current password.
2. Approve the message sent to the current address.
3. Verify the message sent to the new address.

The entire request expires after **30 minutes**. Your profile keeps its original
address until both proofs finish. Cancel a pending request from Account, or
replace it with another password-confirmed request. Cancelled, expired, replaced
and already-used links cannot complete a change. If the new address cannot be
used, no approval message is sent; the request response deliberately does not
reveal whether another account owns it.

Completion preserves the account ID, password, project ownership and project
keys. It invalidates existing password-recovery requests and signs out all
browser sessions and delegated agent connections. Sign in with the new address;
agents must reconnect through consent. Previously displayed/downloaded data
cannot be remotely erased.

A security notice goes to the previous address after completion. Failure to
submit that notice does not roll back a completed change. Account offers a
retry to that fixed previous address for **24 hours**, with bounded attempts.
An initial or new-address message submission failure leaves the address
unchanged; review the request before replacing it. Submission does not prove
inbox delivery.

The public completion page works after sign-out. It displays a short-lived,
one-use server result, never an email address or a success flag from the URL.
Reopening it can show a neutral message; sign in to check the current profile.

## Implementation boundary

The private auth package coordinates the existing Better Auth password and
signed-email proofs. Pending state and token hashes live in purpose-scoped,
expiring verification records; raw proof tokens are not stored there. A locked
account transaction serializes cancellation, replacement and confirmation with
profile updates and session/grant revocation. Outgoing mail is submitted only
after the transaction commits. Native uncoordinated email-change routes are
closed; ordinary signup verification and password recovery retain their existing
behavior. No additional dependency, schema migration or hosted setting is required.
