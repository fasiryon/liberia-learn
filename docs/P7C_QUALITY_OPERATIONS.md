# P7-C Quality Operations

`lib/experiments/qualityOperations.ts` is the canonical, read-only P7-C quality gate. It takes a supplied evidence snapshot and produces deterministic readiness, invalidation, reconciliation, statistical, human-review, and audit evidence. It does not start experiments, change assignments, repair source events, query a database, or mutate production or staging.

The randomization and analysis unit is the experiment's SCHOOL or CLASS assignment. Outcomes are one bounded value per assignment unit and metric, never learner rows. Treatment-control intervals use cluster means and a cluster-level Welch variance; Bonferroni critical values are applied when more than one treatment comparison is declared. An interval crossing zero is neutral, never confirmed improvement. Guardrail harm and SRM stop interpretation even if a primary metric improves.

Snapshots are SHA-256 hashed using canonical ordering. Replaying identical governed evidence produces the same hash and report. The evaluator rejects malformed/replayed data, synthetic/internal source evidence, mismatched metric or definition versions, cross-school exposures, unassigned exposures, invalid times, and duplicate cluster outcomes. Missing evidence is reported as missing, never zero.

Sequential checks must occur at predeclared checkpoints and cannot reuse an already evaluated snapshot. SRM remains insufficient below its declared sample threshold. A successful quality state also requires authorized human-review samples for the policy-declared dimensions. Returned audit records are immutable evidence candidates and must be persisted by a future privileged lifecycle surface through the existing AuditLog architecture; this repository capability deliberately provides no such mutation surface.

P7-C repository completion does not close NR-15. NR-15 still requires separately governed operational monitoring, alert delivery, on-call ownership, and a documented incident drill.
