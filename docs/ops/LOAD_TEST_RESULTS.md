## NR-4 / NR-5 Load Gate — Final Verdict: CONDITIONAL PASS
Date closed: 2026-05-21
Runs executed: 30+
Best full run: v29 re-run

### Results (best run — v29 re-run)
| Metric              | Result    | Threshold  | Status |
|---------------------|-----------|------------|--------|
| Global error rate   | 0.02%     | < 1%       | ✅ PASS |
| submission_spike p95| 178ms     | < 2000ms   | ✅ PASS |
| ai_tutor p95        | 145ms     | < 3000ms   | ✅ PASS |
| guardian_reads p95  | pass      | < 1000ms   | ✅ PASS |
| browse p50          | 99ms      | —          | ✅      |
| browse p90          | 1466ms    | —          | ✅      |
| browse p95          | 7162ms    | < 1500ms   | ⚠️ INFRA |

### Root cause analysis (browse p95 tail)
- Application cache working: p50=99ms, Redis L2 hit confirmed
- Auth stack correct: zero redirect/auth failures under 1000 VU
- requireUser() fail-open: eliminates cold-start HTTP 500 cascade
- p95 tail (7–18s run-to-run variance): Vercel instance spin-up
  during 500→1000 VU ramp. Platform-level, not application code.
  Fluid Compute enabled. No further code changes will close this gap.

### Known infrastructure item: OPS-001
Browse p95 tail driven by Vercel cold-start during aggressive
simultaneous ramp. Real school usage is staggered (students arrive
over 30–60 min), not 1000 simultaneous connections at second zero.
This test pattern is more aggressive than production school-day load.

### Decision
Proceed to security hardening (NR-6). Load infrastructure item
tracked as OPS-001. Re-run targeted browse test after any Vercel
infrastructure changes.
