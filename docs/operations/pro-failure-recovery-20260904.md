# Pro failure recovery — 2026-09-04 UTC

## Allowance policy

Pro admission now reserves daily requests, monthly requests and monthly
characters in one atomic operation. A trusted server-side rewrite failure
restores those allowances once. Successful requests and requests cancelled by
the client after admission remain charged. An already disconnected request
does not start a model runner.

An independent monthly processing-attempt counter bounds retry cost. Its limit
is the monthly request allowance plus `min(5, allowance)`: 105 for the default
100-request plan. Refunds do not reduce that counter. It counts admitted HTTP
rewrite attempts, not individual provider calls inside the repair pipeline.

Refunds address the original UTC buckets and never recreate expired counters.
Cancellation tombstones prevent a late, ambiguously acknowledged reservation
from charging after compensation. A conflicting nonce cannot refund an earlier
request. Settlement replay is idempotent.

Storage failures remain closed. Settlement is retried once; if both attempts
fail, the response is preserved and a secret-free diagnostic is recorded. Such
an outage is not reported as a confirmed refund.

Validation includes concurrency, duplicate settlement, UTC rollover, corrupted
storage, acknowledgement loss, disconnects during admission and real Redis Lua
execution over an isolated Unix socket. No new production dependency is added.

## Monitor delivery

After 8.1.2 deployed, production diagnostics showed all three data adapters
available but `blindnessAcknowledged: false`. The Discord adapter sent the
internal aggregate object directly as the webhook body. Discord requires a
message-bearing field such as `content`; `trigger` and `countBand` alone do not
create a message.

The adapter now serializes the closed aggregate into `content`, disables mention
parsing, and keeps `wait=true` to obtain a message receipt. A regression test
emulates Discord's rejection of the old empty-message envelope.

Reference: https://docs.discord.com/developers/resources/webhook#execute-webhook

Deployment verification must use ordinary cron results and actual receipts.
Do not manufacture customer traffic or an eligible `OBS-ALERT-v1` record.
