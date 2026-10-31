import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import { formatDuration, formatTimestamp } from "./dashboard-data"
import type { RunEvent } from "./run-event-table"
import { buildAttemptSequence } from "./run-attempts-presentation"

export function RunAttempts({
  events,
  onEvidence,
}: {
  events: readonly RunEvent[]
  onEvidence: (id: string) => void
}) {
  const attempts = buildAttemptSequence(events)
  if (attempts.length === 0) {
    return null
  }
  return (
    <section
      className="grid gap-3 p-5"
      aria-label="Explicit operation attempts"
    >
      <h3 className="font-semibold">
        Reported operation attempts ({attempts.length})
      </h3>
      <p className="text-sm text-muted-foreground">
        Application-declared attempts within this execution. Missing numbers are
        unknown; unannotated repeated operations are not retries. Attempts and
        run results are separate counts.
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operation / group</TableHead>
              <TableHead>Attempt</TableHead>
              <TableHead>Reported status</TableHead>
              <TableHead>First evidence (UTC)</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.map((attempt) => (
              <TableRow key={attempt.operationId}>
                <TableCell>
                  <span className="font-medium">{attempt.name}</span>
                  <br />
                  <code className="text-xs">{attempt.groupId}</code>
                </TableCell>
                <TableCell>{attempt.number}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      attempt.status === "failed" ? "destructive" : "outline"
                    }
                  >
                    {attempt.status}
                  </Badge>
                  {!attempt.hasStart && (
                    <span className="block text-xs text-muted-foreground">
                      Start not recorded
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatTimestamp(attempt.timestamp)}
                </TableCell>
                <TableCell>
                  {attempt.durationMs == null
                    ? "Not reported"
                    : formatDuration(attempt.durationMs)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="link"
                    onClick={() => onEvidence(attempt.eventId)}
                  >
                    View event
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
