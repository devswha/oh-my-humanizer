# Kimi Code comparison cohort

Registered before quality collection on 2026-09-05. This cohort follows the
scorer/rewrite fixtures, screening, repetition, cross-family judges and selection
rules in `model-evaluation-20260904.md`. It uses a separate frozen source snapshot
with the directory-binding and receipt-persistence guards. Do not append its
results to an earlier cohort's output directory.

The local Kimi Code 0.29.1 configuration exposes four profiles: `kimi-code/k3`,
`kimi-code/k3-256k`, `kimi-code/kimi-for-coding`, and
`kimi-code/kimi-for-coding-highspeed`. Each returned READY through the restricted
agent profile and passed session-trace verification. Admission is not a quality
ranking. No funded Moonshot API comparison is inferred from this subscription.

Each request uses the reviewed Patina Kimi backend with zero tools, zero
subagents and an empty skills directory. A private export excludes the global
diagnostic log; the collector reads only `agents/main/wire.jsonl` and deletes
the temporary archive. The export must show one request, one usage record,
the selected profile and the hash of an empty tool list. Ambiguous retries,
missing usage, tool access or another profile fail the observation.

Token usage comes from the CLI session trace. The request trace proves profile
selection, not a separately disclosed server model version. Public call rows
therefore mark identity evidence as `cli-request-trace`, keep
`modelIdentityVerified: false`, and identify usage as `cli-session-trace`.
Latency includes process startup and trace verification. Temperature is not
controllable through this CLI. These limits remain visible in comparisons.

The native collector requires the installed `kimi` and `unzip` executables.
Gemini judges continue to use only the loopback OpenCodex proxy. Neither a
Gemini API key nor a direct Gemini CLI fallback is used.
