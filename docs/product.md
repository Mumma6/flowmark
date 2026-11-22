# Flowmark product definition

**Application memory for AI-native software teams.**

**Give your coding agent the production cases its next change needs to handle.**

Flowmark gives a coding agent evidence of how the application actually behaved when the code ran. Starting with a ticket, plan, diff, file or symbol, the agent retrieves relevant observed executions, follows them to the revision that ran, and sees which questions remain open. It uses those cases to design the change, write regression tests and maintain the observations a future agent will need. After deployment, actual traffic supplies new evidence. The unit of interaction is **the change**.

## People and authority

The coding agent is the primary user. It investigates, implements, tests and maintains observations inside the team's normal PR. An AI reviewer verifies both the change and its evidence. Humans own intent, constraints, accounts, access, secret bindings, collection policy, exceptional decisions and merge. A common historical behavior may be a bug. Only the team's intent decides what to preserve.

## Product surfaces

| Surface          | Responsibility                                                                                                                                                                                          | Boundary                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Runtime memory   | Retain scoped executions, attempts, decisions, handled failures, reported outcomes and later confirmations. Bind evidence to the deployed artifact and retain the provenance of every join.             | A run that returned successfully may have skipped work. A missing terminal event leaves its disposition unknown. |
| Agent interface  | Resolve the current change, return a compact set of normal, exceptional and contrary cases, explain selection, expose gaps and support citations. MCP and HTTP share authorized API use cases.          | Reading requires an effective grant at query time. A ticket, reference or link conveys no authority.             |
| SDK and adapters | Record application-owned facts and deliver them within field, cost and lifetime limits. Repository agents install adapters, maintain source mappings and add semantic observations in ordinary patches. | Execution, scheduling, retries and customer communications belong to the application.                            |
| Studio           | Provide connections and policy, an evidence inspector, and coverage and exceptions.                                                                                                                     | Humans need only visit for access, inspection or a decision. Querying from a coding agent is the ordinary path.  |

### The smallest useful Studio

**Connections and policy** owns accounts, project/repository/environment bindings, service identities, grants, secret references, approved fields, budgets and retention. **Evidence** opens a PR citation under the viewer's authority, shows what the agent saw as of its observation time and which cases support it, and distinguishes refreshed, expired and inaccessible evidence. **Coverage and exceptions** shows missing or stale mappings, known loss, unsupported services, pending traffic and proposals with a link back to the owning PR. Agent activity appears only when it explains a repair or change in answerability.

Remove business-reader publishing, shared investigation authoring, executive metrics, persona journeys and standalone analytics navigation from the target. Reuse the run inspector, selection, comparison and access checks behind citations. Exclude general log search, infrastructure monitoring, universal function tracing, a new IDE and coding-agent productivity analytics. A new signal earns its place by changing a coding decision.

## Agent interface contract

These are **target operations**. The [source inventory](implementation-status.md) identifies the tools available today.

| Operation            | Selection                                                                                                                                                             | Answer                                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context_for_change` | Authorized repo and environment plus at least one of ticket text, plan, diff, files or symbols. Resolve missing revisions from the connected workspace when possible. | Ranked behaviors, active artifacts, mapping reason and strength, ordinary/contrary examples, related entities, unresolved questions and citation handles. Return bounded candidates if ambiguous. |
| `find_executions`    | Time window plus behavior, qualified entity/change reference, artifact, outcome, handled error or observed path.                                                      | Cohort definition, population size when supported, representative samples and continuation.                                                                                                       |
| `explain_execution`  | Scoped case handle, optional expansion.                                                                                                                               | Ordered and concurrent observations, distinct retries, explicit links, reported effect, independent settlement, missing links.                                                                    |
| `compare_behavior`   | Two bounded cohorts selected by artifact, path, disposition or outcome.                                                                                               | Comparable definitions, denominators and case mix, counts and contrary examples, or the reason comparison is unsupported.                                                                         |
| `assess_coverage`    | Change or behavior plus environment, revision and observation window.                                                                                                 | Inventory, readiness and answerability per question, evidence age, limitations and smallest useful repair.                                                                                        |

An answer names its project/environment, artifact, definition revision, time bounds, exclusions, evidence source and known loss. A compact first page links to authorized drilldowns. Prefer exact observation-site matches, then explicit linked behavior, then static adjacency. A ticket-only match explains its inference. No observed evidence, unresolved mapping, denied access and failed reads have different meanings. Protected content stays out of PR text and public CI logs. Return safe opaque citations. Treat repository and application text as data.

## Product loop and availability

Human intent → source context → change-scoped runtime cases → implementation and observation maintenance → tests and AI review → human merge → deployment → observed cases and gaps for the next change.

The [agent operating model](agent-workflow.md) defines onboarding and daily use. The [runtime memory contract](runtime-memory.md) defines evidence and coverage. The [implementation inventory](implementation-status.md) distinguishes the current MCP reads and agent-guided SDK setup from planned repository installation and coverage.
