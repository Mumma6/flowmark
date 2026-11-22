# ADR 0021 — Bounded runtime execution reads

Status: Accepted

This extends the read-only MCP contract in [ADR 0008](0008-connect-agent-protocol-contract.md).
The existing tool names and semantics remain available.

## Contract version 1

Both tools require `version: 1` and an explicit `projectId`. They use the
existing delegated diagnostic-access fence, live grant checks, rate limits,
database and tool deadlines, cancellation and serialized response limit.
Business-only grants do not have access to these tools. Runtime references are
evidence and confer no authority.

- `find_executions` takes a UTC start window of up to 31 days, an optional
  workflow, and an optional selector. Selectors support an exact
  `reference: { kind, namespace, digest }`, `artifactDigest`, and
  `behaviorId`. Selector criteria must match the same observed event.
  Artifact and behavior criteria use a bound observation. Narrow the window
  or specify a workflow if the initial application population exceeds 1,000
  runs. The response contains matching execution IDs, recorded status,
  application-reported outcome, count and continuation.
- `explain_execution` takes the internal run ID and returns the recorded
  execution summary with one section. The default `observations` section
  returns observed references, known loss and verified or unknown binding.
  `events`, `related`, `operations` and `expectations` reuse existing
  bounded reads. A partial reported result and a later settlement are
  separate evidence.

The default page size is 10 and the maximum is 25. A cursor belongs to its
project and query filters or execution section. Repeat the same selection
when continuing a page. Cursor input is limited to 512 characters. Current
authorization and retention still apply when reusing a cursor.

Search accepts the already scoped reference digest, as returned by
`explain_execution`. It does not receive raw application reference values or
the emitter's HMAC key. Zero matches describe the eligible recorded population.
Missing observations, unsupported locations and lost telemetry limit what
the agent can conclude. Automatic lookup from a ticket or diff is separate.
