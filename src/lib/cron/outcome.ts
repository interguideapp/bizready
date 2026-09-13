/**
 * Did a fan-out sweep actually work?
 *
 * The two tenant-fanning jobs answered this differently and both were wrong at
 * one end. sync hardcoded `ok: true`, so a night where EVERY connection failed
 * was recorded as a healthy run — which matters more since the integrations
 * screen now reports the sync job's health: it would have said
 * "הסנכרון הלילי פועל" while nothing synced at all. reminders reported ok for
 * a completed loop, which is right for one broken tenant and wrong when the
 * loop achieved nothing for anyone.
 *
 * The boundary that is actually honest:
 *
 *   some worked, some failed  ->  the JOB works, a TENANT has a problem.
 *                                 ok, with the count in the summary. A red
 *                                 heartbeat here would tell every user the
 *                                 service is down because one other account
 *                                 has bad credentials, and would keep the job
 *                                 due so it retried that failure all night.
 *
 *   everything failed         ->  this is not a tenant problem. The provider is
 *                                 unreachable, the decryption key is wrong, the
 *                                 schema moved. Not ok, so the heartbeat says
 *                                 so and jobsDue keeps it due.
 *
 *   nothing to do             ->  ok. An account with no connections is not a
 *                                 broken sync, and reporting failure would put
 *                                 a permanent red mark on an idle job.
 *
 * Per-tenant failures are never invisible either way: sync writes a sync_errors
 * row that surfaces to that owner, and reminders records the ids in the run.
 */
export function fanOutSucceeded(attempted: number, failed: number): boolean {
  if (attempted <= 0) return true;
  if (failed <= 0) return true;
  return failed < attempted;
}
