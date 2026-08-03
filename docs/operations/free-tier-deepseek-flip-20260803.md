# Free tier flipped to deepseek-v4-flash (2026-08-03)

## Why

The free tier was hard down: the production Gemini key returns HTTP 429
"monthly spending cap exceeded" (recorded in
[`dep-prod-disabled-20260803.md`](dep-prod-disabled-20260803.md)). The
deepseek-0731 remeasurement chain
([`serving-engine-deepseek-0731-correction-20260803.md`](serving-engine-deepseek-0731-correction-20260803.md))
established gate parity at ~1/8 the cost, and the owner approved the
free-tier switch on 2026-08-03.

## Validation before the flip

- 22 fixtures × `--repeat 3` at `reasoning_effort: low`: 17 pass / 2 warn /
  3 error on worst-of-three status; every MEDIAN score clears the floors
  (lowest median MPS 80). The three errors are single below-70 MPS samples on
  `en-email-01` / `ko-blog-01` / `ko-news-01` — per-run variance, not a
  register failure. In production such a sample is refused by the MPS floor
  gate (customer sees a retryable error), never delivered silently.
- Code: PR #677 (reviewed) — rewrite reasoning cut scoped to free+deepseek,
  scorer cut extended to deepseek, streaming extraBody passthrough. Shipped
  to main via release PR #678.

## The flip

Vercel env (preview 2026-08-03, then production after #678):
`PATINA_FREE_PROVIDER=deepseek`, `PATINA_FREE_MODEL=deepseek-v4-flash`,
`PATINA_FREE_API_KEY=<deepseek key>`. Explicit redeploy after the env change.

## Post-flip production smoke (patina.vibetip.help)

| probe | result |
|---|---|
| free ko rewrite | 200, 34.2s end-to-end, MPS 100, fidelity 100 |
| number safety | `14:30`, `23,000` preserved |
| scaffold leakage | none (`[SELF_AUDIT]` absent) |
| pro unknown license | 403 `license not entitled` (Polar gate intact) |
| launch config | still the disabled shape |

## Standing notes

- The Pro tier still runs gemini-3.6-flash on `PATINA_PRO_API_KEY`; if that
  key shares the capped Gemini project, Pro serving is still blocked until
  the owner clears the spend cap — unverifiable without a live license.
- Rollback: restore the three `PATINA_FREE_*` values to the gemini set and
  redeploy (values retained in the secret manager history).
- Watch item: DeepSeek announced (date TBA) 2x peak-hour output pricing;
  reassess cost if activated.
