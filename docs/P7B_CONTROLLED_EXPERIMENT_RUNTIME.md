# P7-B Controlled Experiment Runtime

`lib/experiments/controlledExperiment.ts` is the canonical experiment runtime. It supports only deterministic SCHOOL and CLASS assignment. Individual learner assignment is not supported.

Definitions are versioned and validate lifecycle, explicit basis-point allocation, a control arm, governed P7-A metric IDs and current metric version, eligibility/exclusion rules, conflict domains, and predeclared early-stop policies. Mandatory child-safety controls cannot vary by arm. Definitions that attempt it are rejected.

Assignment is derived deterministically with FNV-1a from experiment/version, assignment unit, tenant, and unit ID. It is repeatable across requests and restarts. Assignment is not exposure. Exposure is logged only on encounter through P7-A's `governed.experiment.exposure` contract, with a stable operation identity including session and feature context. Offline clients preserve event time, version, arm, and assignment identity for replay-safe ingestion.

Results report assignment and exposure separately, use P7-A metric version 2, include a definition hash and algorithm version, detect sample-ratio mismatch with a predeclared chi-square threshold after a minimum sample, and provide rate-difference 95% confidence intervals. Insufficient samples never yield a winner. Guardrail breach or SRM invalidates interpretation and triggers the deterministic early-stop result.

The runtime has no management API or production assignment mutation. It exposes a fail-closed lifecycle transition helper that emits an audit record. A future privileged lifecycle surface must persist that record through the existing audit architecture, apply tenant guards, and use this validator; arbitrary JSON editing is not authorized.
