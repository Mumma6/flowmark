import { RunSnapshot, type RunSnapshotProps } from "@flowmark/ui"

const example: RunSnapshotProps = {
  workflow: "customers.import",
  externalId: "IMP-2049",
  environment: "production",
  startedAt: "29 Oct, 14:32 UTC",
  duration: "8.4 s",
  status: "Completed",
  metrics: [
    { label: "Received", value: "1,000", note: "Application-reported" },
    { label: "Imported", value: "988", note: "Application-reported" },
    { label: "Skipped", value: "12", note: "Application-reported" },
    { label: "Recorded events", value: "16", note: "Persisted telemetry" },
  ],
  milestones: [
    {
      id: "source",
      label: "Import customers",
      time: "+0.8 s",
      kind: "checkpoint",
      title: "Import customers",
      description:
        "The application reported receiving 1,000 records from its source file.",
      payload: JSON.stringify({ received: 1000 }, null, 2),
      note: "step · 29 Oct, 14:32 UTC",
    },
    {
      id: "validate",
      label: "Validate records",
      time: "+1.6 s",
      kind: "checkpoint",
      title: "Validate records",
      description:
        "12 records were skipped because an email address was missing. A skipped record does not automatically fail the run.",
      payload: JSON.stringify(
        { valid: 988, skipped: 12, reason: "MISSING_EMAIL" },
        null,
        2,
      ),
      note: "step · 29 Oct, 14:32 UTC",
    },
    {
      id: "crm-error",
      label: "CRM_RATE_LIMIT",
      time: "+2.1 s",
      kind: "error",
      title: "CRM_RATE_LIMIT",
      description:
        "The application reported a handled error. Its own code recovered and continued; Flowmark did not retry the work.",
      payload: JSON.stringify(
        { code: "CRM_RATE_LIMIT", handled: true },
        null,
        2,
      ),
      note: "error · 29 Oct, 14:32 UTC",
    },
    {
      id: "progress",
      label: "Progress reported",
      time: "+5.2 s",
      kind: "progress",
      title: "Progress reported",
      description:
        "The most recent reported snapshot at this point in the run. Progress is an absolute count, not a heartbeat.",
      payload: JSON.stringify(
        { completed: 600, total: 988, unit: "records" },
        null,
        2,
      ),
      note: "progress · 29 Oct, 14:32 UTC",
      progress: { completed: 600, total: 988, unit: "records" },
    },
    {
      id: "sync",
      label: "Sync to CRM",
      time: "+8.3 s",
      kind: "checkpoint",
      title: "Sync to CRM",
      description:
        "The application reported syncing the 988 valid records. The rate-limit recovery remains part of this run’s recorded evidence.",
      payload: JSON.stringify({ synced: 988 }, null, 2),
      note: "step · 29 Oct, 14:32 UTC",
    },
    {
      id: "result",
      label: "Reported result",
      time: "+8.4 s",
      kind: "completed",
      title: "Reported result",
      description:
        "The execution completed. Its reported result is 988 imported and 12 skipped; completion and the business result are separate facts.",
      payload: JSON.stringify(
        { received: 1000, imported: 988, skipped: 12 },
        null,
        2,
      ),
      note: "completed · 29 Oct, 14:32 UTC",
    },
  ],
}

export function WorkflowDemo() {
  return <RunSnapshot {...example} />
}
