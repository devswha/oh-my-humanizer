# Pro monitor endpoint repair — 2026-09-04 UTC

The owner requested completion of the outstanding operational work. Production
request logs still showed recurring `/api/pro-monitor` 503 responses while
rewrites returned 200. PR #723 adds secret-free failure-stage diagnostics and
merged into `dev` after independent review and the full test/lint/CI gates.

## Endpoint evidence

Read the separate log-query project's production deployment metadata through
the authenticated Vercel CLI, then probed its assigned URLs without credentials.

| Route | Observed response |
|---|---|
| Generated deployment URL | 302 to Vercel authentication |
| Team-specific aliases | 302 to Vercel authentication |
| Stable production alias, `/api/query` | 401 application JSON; reached the service's own bearer-auth boundary |

The existing sensitive environment values cannot be read back. This evidence
therefore identifies a reachable target, not proof of the previous configured
URL. Updated production `PATINA_VERCEL_LOG_QUERY_URL` to the verified stable
alias and `PATINA_VERCEL_LOG_QUERY_URL_SHA256` to the lowercase SHA-256 of that
exact URL. Both updates succeeded; stdin contained no trailing newline. The
query token was retained.

## Deployment follow-up

The 8.1.2 diagnostics showed all three adapters available but an unacknowledged
Discord alert. The message-envelope correction in 8.1.3 then restored an ordinary
cron response to 200 on 2026-09-05 (production deployment
`dpl_GMm7a7gYWKSZV737kAqyHkJxZ7xa`). The eligible alert/recovery receipt still
needs its actual runtime evidence; no production traffic or receipt is synthesized
for this check. See `pro-failure-recovery-20260904.md` for the delivery correction.

Rollback can reactivate the preceding immutable production deployment, which
retains its captured runtime configuration. Do not infer the old sensitive
value from the current environment listing.
