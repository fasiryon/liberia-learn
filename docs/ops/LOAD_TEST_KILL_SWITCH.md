# Load-Test Kill-Switch

## Why this exists

NR-4's first production run (2026-07-31, see `docs/LOAD_TEST_RESULTS.md`) was
watched by a passive monitor that only grepped k6's console output for error
and threshold log lines. It had no way to compute a sustained-window breach
and no way to terminate the k6 process. The run went to full completion
(~19 minutes) despite blowing past the agreed abort criteria
(5xx rate > 5% sustained 30s OR p95 > 10s sustained 60s) well before the
halfway point. Real users experienced elevated latency for longer than an
actually-enforced abort would have allowed.

This is a distinct, safety-critical piece of infrastructure, built and
verified before any further load test — including the NR-4 re-run — is run
against production.

## What it is

`scripts/load-test-kill-switch/supervisor.ts` wraps `k6 run`. It does not
watch console text. It tails k6's own `--out json=<file>` output (confirmed
to flush incrementally during a run, not just at exit), keeps a true
rolling-window computation of `http_req_duration` p95 and `http_req_failed`
rate, and sends `SIGTERM` (escalating to `SIGKILL` after a grace period) to
the k6 child process the instant either window breaches its threshold. No
human has to watch the run or react in time — the supervisor process itself
holds the kill authority.

Exit codes:

| Code | Meaning |
|------|---------|
| 0 | k6 completed, all thresholds passed |
| 99 | k6 completed, at least one threshold failed (k6's own exit code) |
| 77 | supervisor aborted the run mid-flight (kill-switch fired) |
| 1+ | other failure (k6 failed to start, etc.) |

On abort, evidence (exact metric value, sample count, window, timestamp) is
written to the `--event-file` path so the trigger is auditable after the
fact, not just logged to a scrollback buffer.

## Usage

```powershell
npx tsx scripts/load-test-kill-switch/supervisor.ts `
  --script load-tests/k6-config.js `
  --out load-tests/results/nr4-run-<date>.json `
  --p95-threshold-ms 10000 --p95-window-s 60 `
  --error-rate-threshold 0.05 --error-window-s 30 `
  --check-interval-ms 3000 --min-samples 20 `
  --event-file load-tests/results/nr4-abort-event-<date>.json
```

Any args after a trailing `--` are passed through to `k6 run` verbatim
(e.g. `-- --env BASE_URL=https://liberia-learn.vercel.app`). Defaults above
match the abort criteria approved for NR-4/NR-5:
5xx rate > 5% sustained 30s, p95 > 10s sustained 60s.

`--min-samples` (default 20) guards against triggering on a handful of noisy
early samples before either window has enough data to mean anything.

## Verification (2026-07-31, local, no production traffic)

Verified against `scripts/load-test-kill-switch/mock-server.ts`, a
controllable local HTTP server whose behaviour flips at runtime via a mode
file (`healthy` / `slow` / `erroring`), driven by
`scripts/load-test-kill-switch/mock-load.js` (20 VUs, configurable duration
via `LOAD_DURATION`). All three runs used the exact same abort criteria as
production (p95 > 10s / 60s window, error rate > 5% / 30s window,
min 20 samples).

| Test | Mode | Natural duration | Actual outcome | Result |
|------|------|-------------------|-----------------|--------|
| Control (no false positive) | `healthy` | 90s | Ran the full 90s, k6 exited naturally with code 0, supervisor exited 0. No abort fired. | **PASS** |
| Latency breach | `slow` (15s/req) | 90s | Aborted at **~18s** into the run. Evidence: `p95 latency 15017ms > 10000ms over trailing 60s (20 samples)`. k6 process confirmed terminated (`tasklist` showed zero `k6.exe` processes, not a zombie). Supervisor exited 77. | **PASS** |
| Error-rate breach | `erroring` (immediate 500) | 90s | Aborted at **~7s** into the run. Evidence: `error rate 100.0% > 5% over trailing 30s (280 samples)`. k6 process confirmed terminated. Supervisor exited 77. | **PASS** |

Both breach paths (the latency OR-branch and the error-rate OR-branch) were
proven independently, not just the combined case. The control run proves the
kill-switch does not trigger spuriously under genuinely healthy load, which
matters as much as proving it fires under real breach conditions — a
trigger-happy kill-switch that aborts good runs is its own failure mode.

## Known limitation

`child.kill('SIGTERM')` on Windows maps to an immediate forceful termination
(`TerminateProcess`), not a cooperative signal k6 can catch and shut down
gracefully from. In practice this means the escalation-to-`SIGKILL` path
after the grace period is unlikely to ever be needed on this platform — the
first `kill()` call already ends the process. The code is written to be
correct cross-platform (real `SIGTERM` then `SIGKILL` escalation on POSIX),
but on Windows k6 does not get a chance to print its own partial summary
before exiting; the supervisor's own evidence file is the authoritative
record of what happened, not k6's stdout.

## Required before this is used against production

None outstanding for the kill-switch itself — it is built and verified. It
must be used for the NR-4 re-run (and any future NR-5 attempt) in place of a
bare `k6 run` invocation. The `MAX_CONCURRENT_DB_FALLBACKS` cache-stampede
fix (see `docs/LOAD_TEST_RESULTS.md`) is separate, unrelated work and is not
a prerequisite for the kill-switch itself, only for NR-4 to have a realistic
chance of passing on the re-run.
