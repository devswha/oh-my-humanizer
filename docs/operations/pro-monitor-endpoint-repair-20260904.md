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

## Verification still required

The change applies to the next production deployment. After 8.1.2 deploys, read
the ordinary cron's response status and new diagnostic event. A 401 anonymous
probe alone does not prove authenticated aggregate queries work. The healthy
alert/recovery receipt also needs its actual runtime evidence; no production
traffic or receipt is synthesized for this check.

Rollback can reactivate the preceding immutable production deployment, which
retains its captured runtime configuration. Do not infer the old sensitive
value from the current environment listing.
