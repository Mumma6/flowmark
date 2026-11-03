# Understanding the Meridian Health demo

Start here if the workflow names and charts make sense technically, but you
are unsure what Meridian is trying to accomplish or what to investigate.

Meridian Health is a fictional integration platform used by several healthcare
providers. In this demo, its application receives referral batches, matches
accepted referrals to patient references, requests appointments and dispatches
notifications. It also synchronizes laboratory results and checks external
integrations. All records and organizations are synthetic.

The operational question is: **did the application report accomplishing the
intended work, and where does the recorded evidence need further investigation?**
A batch finishing does not mean every referral was accepted. A booking request
finishing does not mean an appointment was confirmed.

## How the work fits together

The main journey is a referral being received, matched, booked and followed by
a notification. The application records explicit links between sampled runs so
you can follow some journeys across workflow names.

1. `referral.ingest` receives a batch. Some records are accepted; others are
   rejected, flagged for review or identified as duplicates.
2. `patient.match` attempts to match a sampled accepted referral to a patient
   reference. An ambiguous, invalid or unmatched result stops that journey.
3. `appointment.book` requests an appointment for a matched referral. The
   result can be confirmed, pending, unavailable or conflicting. Technical
   failures can leave business counts unknown.
4. `notification.dispatch` records synthetic notification dispatches for
   journeys that reach that stage. Inspect the reported delivery result
   separately from execution completion.

`lab-results.sync` is a separate batch process. `integration.health-check`
checks external availability. They provide additional evidence about the same
providers and integrations; they are not mandatory steps in every referral
journey. Related observations do not by themselves prove a shared cause.

Referral batches contain hundreds of records, but downstream journeys are
**samples**, not a complete expansion of every accepted referral. Do not use
the number of downstream runs as an exhaustive referral conversion funnel.
Application-owned retries also create separate executions, so execution totals
are not deduplicated business entities.

## The organizations and integrations

Here, a **provider** is a healthcare organization, a **clinic** is one of its
locations, and an **integration** is an external system Meridian talks to.

| Provider                          | Clinics          | Scheduling                 | Laboratory             |
| --------------------------------- | ---------------- | -------------------------- | ---------------------- |
| Northstar Care (`northstar-care`) | River and Meadow | Atlas (`atlas-scheduling`) | Aurora (`aurora-labs`) |
| Cedar Health (`cedar-health`)     | Grove and Hill   | Orbit (`orbit-scheduling`) | Beacon (`beacon-labs`) |
| Harbor Clinics (`harbor-clinics`) | Quay             | Atlas                      | Aurora                 |
| Harbor Clinics (`harbor-clinics`) | Bay              | Orbit                      | Beacon                 |

Referral batches come from Northstar Referrals, Cedar Connect and Harbor Link.
Meridian Notify is the synthetic notification integration.

This distinction matters when narrowing a problem. For example, Orbit is used
by both Cedar clinics and Harbor Bay. A scheduling problem involving Orbit is
therefore a different question from poor referral data supplied by Cedar
Connect. Filter by `provider`, `clinic` or `integration` to inspect the relevant
population instead of assuming the entire project is affected.

## What each workflow tells you

| Workflow                   | Question to answer                                             | Reported evidence to inspect                                                                                                                      |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `referral.ingest`          | Was the received referral batch usable?                        | `received`, `accepted`, `rejected`, `review`, `duplicates`, and reasons such as `missing_clinic` or `missing_contact`.                            |
| `patient.match`            | Could Meridian identify a patient reference for the referral?  | `checked`, `matched`, `ambiguous`, `unmatched`, `invalid`. A completed execution can report an unsuccessful match.                                |
| `appointment.book`         | Was an appointment actually reported confirmed?                | `requested`, `confirmed`, `pending`, `unavailable`, `conflicts`, plus expected confirmations and their observed resolutions.                      |
| `notification.dispatch`    | What delivery outcome did the application report?              | `requested`, `delivered`, `rejected`, `pending`. Dispatch completion and reported delivery are separate observations.                             |
| `lab-results.sync`         | Which laboratory records were synchronized or left unresolved? | `received`, `synchronized`, `rejected`, `delayed`, and the supporting operations and errors.                                                      |
| `integration.health-check` | What availability did Meridian observe?                        | `checked`, `reachable`, `unavailable`, with the integration and observation time. This is sampled evidence, not continuous availability coverage. |

These are application-reported results. Missing fields remain unknown. A later
observed confirmation does not rewrite the original terminal business result;
inspect both the result and the confirmation evidence when they differ.

## Four investigations with a useful finishing point

Sign in to the [Staging dashboard](https://app.staging.flowmark.dev/sign-in)
and select **Meridian Health**. Start with a 30-day window covering the dataset.
The fixed dataset ages: relative date filters and confirmation deadlines use
the current time, so inspect the displayed dates rather than assuming every
example remains recent or pending.

### 1. A process completes, but some referrals need attention

Open **Insights**, select `referral.ingest` and inspect its reported business
outcomes using definition `meridian-v1`. Compare `rejected` with `received` and
narrow the configured provider dimension to `cedar-health`. Inspect recorded
reasons, then open supporting runs and their context.

The scenario contains poorer Cedar referral data on logical days 18–23. Look
for evidence of rejected records even when the enclosing runs completed.

**Finish with:** the provider and period examined, the reported rejected and
received counts, the recorded rejection reasons, and example runs. That is
useful input for investigating the referral source and correcting the rejected
records in the owning application; it is not a reason to rerun an entire batch
without checking what already succeeded.

### 2. Appointment requests slow down or fail

Open **Issues** and inspect scheduling failures such as `SCHEDULER_TIMEOUT`
or `SCHEDULER_UNAVAILABLE`. Follow a group to matching runs. Inspect their
operations, attempts and context, and compare scheduling duration in
**Insights** for `appointment.book`. Use the enabled integration field to
isolate `orbit-scheduling` when exploring runs or reported-result dimensions.

Orbit degradation is represented on days 11–17, including outages on days
14–16. The history also includes separate application-owned retry executions.

**Finish with:** affected executions, the relevant integration, recorded error
codes and timing, and whether a later retry or confirmation was observed. Use
that evidence to investigate scheduling in the owning application or upstream
system. Flowmark does not perform the retry.

### 3. A completed booking still lacks confirmation

Find `SYN-BOOK-RECENT` using the configured `bookingRef` business-reference
lookup on `appointment.book`, or the dashboard's configured lookup search.
Open the run and inspect both its final reported result and its expected
confirmation. The original result is pending and omits `confirmed`; it does
not invent a zero confirmed count. Its expectation can become overdue as
time passes after the dataset reference.

**Finish with:** the booking reference, what the terminal result reported, the
confirmation deadline and any observed resolution. You can then investigate
the acknowledgement in the owning scheduling application. A technical
Completed badge alone does not answer whether the booking was confirmed.

### 4. Decide whether the recovery period answers your question

Use **Insights** to inspect the later part of the recorded history, then check
the relevant workflows and supporting runs. Days 24–30 represent recovery,
with some remaining timeouts on days 24–26. Older unresolved confirmations and
one run without terminal telemetry remain in the dataset.

**Finish with:** a scoped statement about the period and measurements you
examined, plus any older unresolved evidence that still needs investigation.
Improved recent technical measurements do not establish that every historical
business item has been resolved. Missing terminal telemetry does not establish
that a run is still active or has failed.

## What to take away from a session

A useful investigation identifies the question, the population and time window,
the reported facts, and the next action in the owning application or team.
Keep the relevant run IDs, business references, errors and timestamps with
your conclusion. The dashboard's **Take findings forward** run section provides
a copyable factual handoff; add your own diagnosis separately.

This guide explains the demo's fictional business context. Customer-specific
business explanations are not built into Flowmark's generic dashboard.
For generation, dataset ownership and operating commands, see the
[demo README](README.md).
