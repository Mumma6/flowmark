# Compact historical facts

Historical search, run summaries, outcome windows, technical metrics and operation
comparison use PostgreSQL projections maintained in the same transaction as an
accepted raw event. The SDK and wire contract are unchanged. Definitions still
select their original revisions; intermediate reports never become final results.

`workflow_run_facts` contains one row per projected run: status, terminal duration,
latest step, terminal result, definition revision and failure code. Version,
receipt watermark and ordering keys support reconciliation and deterministic
updates. Existing run rows remain authoritative for IDs, properties, outcome,
environment and release.

`workflow_metric_facts` contains only operation start/terminal samples and failed
run samples: event/run IDs, type, operation identity/name, duration, failure code
and timestamps. It copies no context, error messages, expectation payloads or
reports. Operation comparison folds samples into occurrences; technical metrics
retain their existing terminal-event denominators and percentiles. Summed recorded
operation durations do not measure parallel wall time.

## Lifetime and evidence

The reference deployment's existing 30-day telemetry policy also applies to these
facts. This change adds no cleanup job, deletion, retention extension or
summary-only history. Facts and their raw evidence share run ownership. Existing
run/timeline links remain the investigation surface.

Future retention cleanup must delete the complete owned run and its events in
one transaction, respecting expectation ownership. Metric facts cascade with raw
event deletion, and both fact tables cascade with run deletion. Do not purge only
events while retaining a run summary: that would leave an uninspectable summary.
No automatic cleanup or hosted backfill is authorized by installing this schema.

## Incremental writes and repair

Migrations 0015/0016 install an `AFTER INSERT` trigger on raw events. Both current and
older app revisions therefore maintain the projections in their existing write
transactions. Deduplicated/rejected/ignored events insert no raw row and cannot
advance facts. Per-run locking serializes writers and backfill. The first insert
into a historical unprojected run rebuilds that run; subsequent inserts update
selected fields incrementally and append narrow metric samples.

Historical mixed terminal states still prefer Failed. Terminal time, non-null
result and failure code are selected independently, as before. For events whose
occurred and created timestamps are identical, event row UUID supplies a stable
tie-breaker for both raw fallback and facts. This resolves previously unspecified
ties; it does not claim a causal ordering. Start definition selection retains its
existing created-time/UUID ordering.

Raw events are append-only outside separately approved maintenance. If an operator
repairs existing event values, explicitly rebuild affected runs before accepting
fact-backed reads. Rebuilding replaces facts atomically from the current raw
history; changing workflow declarations never rewrites historical revisions.
The source receipt is a reconciliation watermark, not a general detector of
out-of-band SQL edits. Disabling the trigger is not a supported write path.

## Local bounded backfill

Use a dedicated disposable loopback database. Supply `DATABASE_URL` explicitly;
the command never loads an env file and refuses hosted URLs and production mode.
Run committed migrations first, with both database URL variables pinned to the
same test database as described in [migrations](migrations.md).

```sh
DATABASE_URL=postgresql://127.0.0.1:5432/flowmark_test \
  pnpm --filter @flowmark/db db:facts:backfill \
  --project <project-uuid> --batch-size 25 --max-runs 100

DATABASE_URL=postgresql://127.0.0.1:5432/flowmark_test \
  pnpm --filter @flowmark/db db:facts:backfill \
  --project <project-uuid> --batch-size 25 --max-runs 100 \
  --checkpoint /tmp/flowmark-facts-checkpoint.json --apply
```

Default is dry-run; it reports inspected/fresh/needs-rebuild counts and a cursor,
without writing projections or checkpoint files. Coverage includes missing/stale
run facts, source receipt watermarks and narrow metric-sample counts. Batch size is 1–100, and one
invocation inspects at most 1–10,000 runs. Each batch uses a UUID keyset, run locks,
a 5-second lock timeout and a 30-second per-statement timeout. Errors stop the
command, never become empty successful results. Counts and cursors contain no
business payloads.

Apply requires a checkpoint. Its version, project and database fingerprint are
validated on resume. Each checkpoint is replaced atomically only after its batch
commits. If the process dies between commit and checkpoint replacement, repeating
the prior batch is safe. Keep one operator per checkpoint. Repeat the exact
command to resume; a completed cursor does not automatically restart from zero.
A dry-run can use `--after <uuid>` instead of a checkpoint.

Once the first pass completes, start a **new checkpoint** from the beginning for
reconciliation: runs created after an earlier cursor may sort before it. Run a
fresh dry-run across the whole project in bounded pages and require no missing or
stale watermarks. Inserts made by old app revisions are covered by the trigger.
Keep rebuilding available for explicit repairs; do not put backfill in requests,
builds, migrations or a scheduled job.

## Read cutover and rollout

Schema installation is additive and does not scan historical events. Older apps
continue working. New readers prefer version-1 facts. For each unbackfilled run,
a lateral raw aggregate preserves existing semantics; metric reads similarly use
raw samples only for unbackfilled runs. This is a temporary migration path, not
proof of a completed backfill. The command's coverage report exposes remaining
work. Errors propagate normally. Once projected, reads do not reconstruct that
run's raw events; SQL plans must verify the raw branch is never executed for a
fully projected cohort. Partial backfill still has raw-history cost for the
remaining runs, so finish reconciliation before claiming the performance gain.

1. Review migration SQL, including functions/triggers, and verify local upgrade,
   parity, resume/repair and query plans. Include generated Drizzle metadata.
2. Follow the existing Preview → Staging → Production migration/deployment gates.
   Schema must precede readers. Never edit applied migration history. An app
   rollback leaves the additive schema and projection trigger in place.
3. Hosted historical backfill requires separate approval for the exact environment,
   reviewed revision, project, batch/budget and checkpoint. The shipped CLI is
   intentionally loopback-only. Do not bypass its guard or copy production data
   into a local DB. Prepare a reviewed hosted runner before that operation.
4. A hosted runner must validate the exact direct target/environment and migration
   history, execute the same `backfillRunFacts` page operation with a bounded
   budget, durably save checkpoints only after commit, and support dry-run first.
   Stop on timeout/lock errors. Reconcile from zero and verify raw/fact parity on
   bounded samples plus missing/stale counts, without logging customer values.
   Retention cleanup, deployment and SDK publishing remain separate approvals.

Local tests exercise old-style raw inserts as well as accepted SDK ingestion,
legacy mixed terminals, missing results, separate reports, repeated/late operation
samples, project isolation, transactional rollback, keyset resume and repair.
Production performance and storage costs require deployment-specific measurement.
