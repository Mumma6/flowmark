import { sql } from "drizzle-orm"
/** Fixed r/c aliases belong to the capture queries. One policy for capture, read and purge. */
export const captureSourceDeadline = sql`LEAST(r.started_at+interval '30 days',r.created_at+interval '30 days')`
export const effectiveCaptureDeadline = sql`LEAST(c.expires_at,${captureSourceDeadline})`
export const expiredCapture = sql`clock_timestamp()>=${effectiveCaptureDeadline}`
