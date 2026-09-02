# Exit Codes

patina uses stable exit codes so CI and editor integrations can distinguish content gates from setup failures.

| Code | Meaning |
|---:|---|
| `0` | Success. For `--score --exit-on <n>`, the parsed `overall` score was at or below the threshold. |
| `1` | Runtime/backend failure: API/auth/backend errors, failed doctor blockers, invalid runtime setup, or unexpected exceptions. |
| `2` | Input/usage failure: unknown flags, missing required option values, empty stdin, or `--no-interactive` with no input. |
| `3` | Score gate exceeded. `--score --exit-on <n>` completed, but `overall > n`. |
| `4` | Meaning-safety exit on a rewrite: `--verify` found no candidate above the MPS/fidelity floors, or the dropped-number guard found a source number missing from the rewrite. **The rewrite is still printed to stdout.** |
| `130` | Interrupted (SIGINT / Ctrl-C). |

Codes are merged with `Math.max` when more than one applies, so a run that both
exceeds a score gate and hits a runtime error reports the stricter code.

> A backend subprocess exiting `75` (`EX_TEMPFAIL`) is a *retryable storm* signal
> that batch mode acts on internally; it is not a patina exit code.

## Meaning-safety exit (exit `4`)

Two deterministic checks in the rewrite path raise exit `4`:

| Trigger | Fails when |
|---|---|
| `--verify` floor | after the rewrite and one conservative retry, no candidate reaches `verification.mps-floor` / `verification.fidelity-floor` (defaults 70); stderr shows `[patina] verify: MPS …, fidelity … (below floor)` |
| dropped-number guard | a number present in the source is missing from the rewrite (`droppedNumbers`), with or without `--verify` |

Exit `4` is **enforcing but non-destructive**: patina prints the rewrite anyway
and warns on stderr so a human can review it. Automation should treat `4` as
"output produced, needs review" — not as a runtime failure, and not as clean
success.

```bash
patina --lang ko draft.md; echo "exit=$?"   # exit=4 when a year or figure vanished
```

Because MPS/fidelity come from a model call, the `--verify` trigger is not
deterministic across runs of the same input; the dropped-number guard is.
Suppressing stderr with `--quiet` hides the reason but does not change the
exit code.

Persona voice-match and surface-churn results are **advisory only**: they warn
on stderr and never change the exit code.

## Score gates

```bash
patina --lang en --score --exit-on 30 draft.md
```

`--exit-on <n>` prints the score output as usual; only the process exit code changes to `3` when the threshold fails.

## Empty input

- Piped empty or whitespace-only stdin exits `2` and prints a three-line `[patina] Error:` message.
- In an interactive TTY, patina prompts for one-shot stdin and waits until Ctrl-D.
- `--no-interactive` restores script-safe no-input behavior: no prompt, exit `2`.
