# Account security and browser sessions

Open **Settings → Security**, or `/account/security`. The standalone page is
available before project creation or onboarding completion. Existing Account
settings and password deep links remain available.

Active sessions show an approximate device label, sign-in time, update time and
expiry. **This session** identifies the request's current browser session. Device
labels come from untrusted user-agent text; update time is not proof that someone
recently used the account. Full IP addresses, raw user agents and session bearer
tokens are not shown.

Choose **Sign out session** or **Sign out all other sessions**, then confirm your
current password. Confirmation is bound to the current session at review time;
a changed sign-in requires a fresh review. Five attempts per account are allowed in a fifteen-minute
window. The server resolves the selected opaque session ID within the signed-in
user's active provider sessions. Other sessions lose access on subsequent
protected requests; the current session and other accounts remain signed in.
A failed bulk request may have revoked some sessions, so the list is refreshed
and completion is not claimed until the provider confirms success.

**Sign out on this device** uses the provider's normal cookie-clearing flow,
clears the local private query cache and returns to sign-in. Password changes
continue to sign out other sessions and refresh the session list.

Session sign-out is distinct from revoking independently granted agent
connections or project ingestion/read keys. Manage those through Connect and
API keys. Previously downloaded or already displayed data on another device
cannot be remotely erased.

Session summaries and revocation use private/no-store, session-only procedures.
Revocation additionally requires the trusted Studio origin and a server-verified
password; bearer API/agent credentials cannot authorize it. Native token-bearing
session-list and raw session-revoke HTTP routes are closed in favor of this
boundary. Better Auth's private server APIs remain the authoritative lookup and
revocation mechanism; no separate session store or schema is added.

An expired or insufficiently fresh provider session requires signing in again.
Use **Sign out and sign in again** when the session list requires fresh login;
this clears the old cookie before opening sign-in, avoiding an authenticated
redirect back to Studio.
Revocation does not bypass account-deletion fences. Email changes and broader
account-settings organization are separate work.
