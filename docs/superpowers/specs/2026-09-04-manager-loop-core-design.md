# Manager Loop — Sub-project 1: Core Durable Mission/Phase Loop (Design)

**Date:** 2026-09-04
**Status:** APPROVED for implementation planning.
**Scope constraint:** This document covers Sub-project 1 only — the durable persistence,
state machine, Manager/Implementer protocol, checkpoint/resume, progress instrumentation,
and governance-gate integration. It explicitly excludes the stall-policy engine, Mission
Control UI, bounded parallel workers, and curriculum-specific mission templates (Sub-projects
2-5, tracked in `docs/roadmaps/CONSOLIDATED_BACKLOG.md` as queued follow-on work, not built here).

---

## 1. Problem statement

Long-horizon work (a multi-phase roadmap item, a large remediation, a curriculum unit) run by
a single continuous agent session tends toward one of two failure modes: it drifts into
unnecessary local optimization on already-acceptable work, or it loses coherent state across
context limits, restarts, and new sessions and cannot resume without re-deriving everything
from scratch. Neither failure is really about the model — it is about the absence of a
persistence layer that survives outside any one conversation.

Manager Loop's core operating principle: **complete the current phase completely and
extremely well, satisfy explicit acceptance criteria, then move on.** Not perfect. Not
infinite refinement. Acceptance-complete.

This document defines the persistence + protocol substrate that makes that principle
enforceable rather than aspirational — a state machine a session cannot talk its way around,
because completion is a database fact, not a chat claim.

## 2. Correction to prior record

`docs/superpowers/specs/2026-07-06-agent-platform-foundation-design.md` (Sprint 6.0) recorded
`lib/autonomous/` ("Family B") as dead — zero rows, never invoked, safe to ignore. That was
accurate on 2026-07-06. It is stale now. Investigation for this design (2026-09-04) found
`lib/autonomous/` has grown into an actively-maintained ~90-file system (`actions/`,
`detectors/`, `evaluation/`, `memory/`, `optimization/`, `predictions/`, `runtime/`,
`signals/`, plus core orchestration), wired to roughly 50 admin/ops pages, 40 API routes, and
5 crons, with "Phase 13-15... SHIPPED" per `docs/roadmaps/CURRENT_EXECUTION_STATE.md`. Any
future session relying on the 2026-07-06 characterization should treat this document as the
current record instead. (Session memory has been corrected accordingly — see
`feedback_lib_autonomous_not_dead.md`.)

## 3. Runtime model — the boundary that shapes everything else

**Manager Loop does not itself acquire filesystem, shell, or git execution authority.** It
defines a durable orchestration contract; Claude Code sessions that already have those
capabilities operate against it.

- **Persisted state is the single source of truth for mission/phase/task progress.** Not a
  chat transcript, not a session's memory of what it did.
- **Manager** = a Claude Code session operating in the Manager role: reads current
  mission/workflow state, decomposes work into phases (and, within a phase, tasks/checklist
  items), persists that decomposition, dispatches exactly one bounded phase at a time, reviews
  returned evidence against real (not self-reported) governance/quality gate output, and
  writes the accept/reject/block decision as a legal state transition.
- **Implementer** = a *separate* Claude Code session operating in the Implementer/Coder role:
  loads one dispatched phase from persisted state, works only within that phase's bounds using
  normal repository capabilities (Read/Edit/Bash/git/tests), persists checklist progress,
  attaches structured evidence, writes checkpoints, and enters `VERIFYING` only when the phase
  is actually ready — never by declaring "done" in chat alone.
- **Later, optional bounded workers** (Sub-project 4) are additional Claude Code sessions
  under the same contract, not a new capability.
- **`lib/agents/`'s existing constrained LLM-tool-calling harness (`AgentInvocation`,
  `AgentGoal`, `AgentControl`, `EscalationQueue`) remains a separate, lower-level runtime** for
  its existing production use cases (echo, content-qa, ops-sentinel, etc.). Manager Loop does
  not fold into it, replace it, or require changing it. A later, explicit decision could
  connect the two; this design does not make that decision.
- **True unattended operation is a later scheduling concern, not an architecture concern.**
  Whatever eventually drives a headless Manager or Implementer turn — `/loop`, `CronCreate`, a
  different runner — must consume this exact persisted protocol unchanged. Sub-project 1 is
  not designed around any specific scheduler, and does not build one.

A phase is not complete because a session says so. Completion exists only as a persisted state
transition that has satisfied its legal-transition rule, its checklist, its evidence
requirements, and any governance/quality gate its acceptance criteria names.

### 3.1 Resume proof criterion

A new Manager or Implementer session, given only a mission id (or none — it can list open
missions) and **no prior chat transcript**, must be able to answer, from persisted state
alone:

- mission objective, scope, constraints
- current phase, its objective and acceptance criteria
- current task/checklist state (done, pending, blocked, skipped-with-reason)
- prior failed approaches (recorded, not silently retried)
- relevant decisions (Manager's accept/reject history with reasons)
- the Git SHA / checkpoint the phase last verified against
- test/evaluation state (what was last run, what it showed)
- the exact next action

This is the concrete, testable definition of "durable rather than conversation-bound" this
design is built to satisfy — see §10.

## 4. `lib/autonomous/` — what is reused, what is added

Full triage in the implementation plan's supporting notes; summary of the decision:

**Reused entirely unchanged:** `WorkflowCheckpoint` (already append-only, sequenced,
evidence-ref carrying — exactly the Checkpoint primitive needed), `AgentDecision` (Manager's
accept/reject/block decisions), `ApprovalRequest` (human-approval gate when a phase's
acceptance criteria requires one), `ActionExecution` (governed side-effect bookkeeping),
`ExecutionTrace` (span tracing for Manager/Implementer/Phase spans).

**Reused with a small additive FK:** `WorkflowStep` gains an optional `workflowPhaseId` so an
Implementer's granular steps can nest under a Phase; detectors keep writing ungrouped steps
exactly as today, unaffected. `AgentRun` gains an optional `workflowPhaseId` for traceability
of which Phase an agent run executed under.

**Extended in place, not renamed:** `WorkflowRun` gains nullable `objective`, `scope` (Json),
`constraints` (Json), `acceptanceCriteria` (Json), `dependsOnRunIds` (Json array of
`WorkflowRun.id`). Populated only when `workflowType` is namespaced `mission.<slug>` (matching
the existing `detector.${detectorId}` convention) — every existing detector/optimization
caller is unaffected because the new columns default null and nothing reads them.

**New tables:**
- `WorkflowPhase` (FK `workflowRunId`): `sequence`, `title`, `objective`, `acceptanceCriteria`
  (Json), `status`, `dependsOnPhaseIds` (Json array), `attempt` (Int, default 0),
  `lastProgressAt` (DateTime?), `blockedReason` (String?), `startedAt`/`completedAt`
  (DateTime?), timestamps. `attempt`/`lastProgressAt` exist now purely as data surface for
  Sub-project 2's future stall detector — Sub-project 1 writes them, does not act on them.
  Write rule (so there is no ambiguity for the implementation plan): `attempt` starts at 1 when
  `dispatch-phase.ts` first moves a phase to `IN_PROGRESS`, and increments each subsequent time
  a phase re-enters `IN_PROGRESS` from `BLOCKED` or from a rejected `VERIFYING`.
  `lastProgressAt` is set to the current time by `report-phase.ts` on every call that changes at
  least one `WorkflowChecklistItem`'s status or writes a new checkpoint — a call that changes
  nothing is not progress and must not update it.
- `WorkflowChecklistItem` (FK `workflowPhaseId`): `label`, `required` (Boolean, default true),
  `status` (`PENDING`/`DONE`/`SKIPPED`/`BLOCKED`), `evidenceRef` (Json — a pointer: file path,
  gate-report id, test-run summary path, PR link; never inlined content, matching the existing
  `ApprovalRequest`/`AgentDecision` evidence-ref convention), `completedAt`.

**Explicitly not built on:** the `OptimizationChangeRequest`/`ChangeRequestSignoff`/
`StagedRolloutPlan`/`PostChangeEvaluationPlan` family (Phase 7) — a real, live, but narrowly
governed-config-change pipeline; its `Json` checklist/plan field shapes are useful precedent,
not a foundation to extend. `QualityReviewTask`/`QualityReviewAssessment` is reused, not
duplicated, whenever a phase's acceptance criteria requires a human quality-review gate rather
than a plain approval.

**Migration:** one additive Prisma migration. All new columns nullable, all new tables net-new
— no existing row, route, or cron is touched. Per the standing escalation contract, agent
platform-adjacent schema changes are pre-cleared for review; this migration also does not
touch `Student`/`Guardian`/`User`/`StudentProgress` or any table serving live users.

## 5. `AgentGoal` boundary — canonical rule

`AgentGoal` (`lib/agents/`) and `WorkflowRun`/`WorkflowPhase` (`lib/autonomous/`) are, and must
remain, cleanly separate systems. Confirmed today: no code path feeds `AgentGoal.status` into
any `WorkflowRun`/`WorkflowStep` completion logic, and no dashboard reads both in one
completion computation.

**Rule:** an Implementer session's own multi-step continuation (e.g., pausing mid-phase,
resuming later within the same phase) may use `AgentGoal` purely as its own execution ledger.
**Phase and mission completion must be judged exclusively from `WorkflowPhase` /
`WorkflowChecklistItem` / `WorkflowStep` status — never from `AgentGoal.status`.**
`AgentGoal.status = COMPLETED` means "ran out of steps," not "met the objective," and must
never be treated as equivalent to a phase reaching `COMPLETE`. This is enforced by convention
and code-review discipline (documented here and at the relevant call sites), not by a new
coupling table — the two systems staying disjoint is the point.

## 6. State machine

Phase status: `NOT_STARTED → IN_PROGRESS → {BLOCKED, VERIFYING, FAILED}`;
`BLOCKED → {IN_PROGRESS, FAILED}`; `VERIFYING → {COMPLETE, IN_PROGRESS, FAILED}`; `COMPLETE`
and `FAILED` are terminal. A pure `assertLegalTransition(current, next)` function is the single
gate every writer (CLI script) goes through — `WorkflowRun.status` today is an unconstrained
string with no enforcement anywhere; this is new discipline layered on top for `mission.*`
rows, not a change to existing detector/optimization semantics.

Mission-level status is derived from aggregate phase state (all phases `COMPLETE` → mission
`COMPLETE`; any phase `FAILED` and not recoverable → mission `FAILED`; otherwise
`IN_PROGRESS`), never set independently by a session.

A phase may only reach `COMPLETE` when, at the moment of transition:
- every `required` `WorkflowChecklistItem` is `DONE` or `SKIPPED` with a recorded reason
- the phase's `acceptanceCriteria` evaluate true against live evidence
- named tests pass (evidence: a checkpoint recording the actual run output/summary)
- named quality/governance gates return a non-blocking verdict (see §7) — re-derived live by
  the Manager session, never accepted on the Implementer's say-so
- any required human-review or approval step is resolved (`ApprovalRequest` approved, or
  `QualityReviewTask` passed, whichever the phase names)
- Manager has written an explicit `AgentDecision` (`decisionType: "phase_acceptance"`,
  outcome `ACCEPT`)

## 7. Governance/quality gate integration

A phase's `acceptanceCriteria` (Json) names the real checks it depends on — e.g., "release
gate verdict for surface X is PASS or WARN, not BLOCK," "quality-operations evaluation for
experiment Y is READY," "these named tests pass," "QualityReviewTask #Z resolved PASS." The
Manager session's review step evaluates these by calling the actual governance modules
(`governedMeasurement`, `controlledExperiment`, `qualityOperations`, `releaseGate`,
`calibration`, `fixtureRegistry`, `reviewTasks`, curriculum-approval routes) or reading their
most recent recorded verdict directly — it does not trust an Implementer's report that "the
gate passed." A `BLOCK` verdict (or any other named-authority rejection) makes the
`VERIFYING → COMPLETE` transition illegal; Manager Loop code hard-fails the attempt rather than
recommending against it. No phase, however dispatched, can self-authorize around an existing
blocking gate.

## 8. Manager ↔ Implementer protocol

No separate message table — the brief *is* `WorkflowPhase` plus its `WorkflowChecklistItem`
rows. A small CLI (`scripts/manager-loop/`) is the only interface either role needs:

- `create-mission.ts` — Manager creates a `WorkflowRun` (kind `mission.<slug>`) with
  objective/scope/constraints/acceptanceCriteria.
- `plan-phases.ts <missionId>` — Manager persists the phase decomposition (`WorkflowPhase` +
  initial `WorkflowChecklistItem` rows) it produced.
- `dispatch-phase.ts <phaseId>` — prints the structured brief: mission objective/scope/
  constraints, phase objective/acceptance criteria, dependencies, checklist, and the governing
  authorities the Implementer must never bypass.
- `report-phase.ts <phaseId> --status VERIFYING|BLOCKED --evidence <json>` — Implementer writes
  checklist updates plus a `WorkflowCheckpoint` (evidence-ref carrying), validated against the
  legal-transition rule.
- `review-phase.ts <phaseId>` — Manager re-derives gate verdicts and checklist completeness
  from live state.
- `accept-phase.ts <phaseId>` / `reject-phase.ts <phaseId> --reason "..."` — writes the
  `AgentDecision`, advances the next eligible phase (dependencies satisfied) or bounces the
  current one.
- `status.ts [missionId] [--json]` — **read-only** inspection: mission/phase/checklist state,
  last checkpoint, last progress timestamp, pending dependencies, prior failed approaches, and
  the exact next action. This doubles as the resume mechanism (§3.1) and as the "minimal
  status surface" the scope calls for — it is deliberately not a write path.

## 9. Evidence and checkpoints

All evidence is a pointer (`Json`: file path, gate-report id, test-run summary path, PR link),
never inlined content — consistent with the existing `ApprovalRequest`/`AgentDecision`/
`ActionExecution` convention, so nothing new is invented here. `WorkflowCheckpoint` (reused
unchanged) is written at least at every phase-status transition and after any checklist item
completes; it is already append-only and sequenced, so no versioning scheme is added.

## 10. Testing plan

- State machine: every legal and illegal transition, including the mission-level aggregate
  derivation.
- Migration: additive-only check (existing tests for detector/optimization workflows must
  pass unchanged after the migration).
- CLI round-trip: create-mission → plan-phases → dispatch-phase → report-phase →
  review-phase → accept-phase, and the reject/re-dispatch path.
- **Gate-block test**: a phase whose named release-gate verdict is `BLOCK` must fail the
  `VERIFYING → COMPLETE` transition even when every checklist item is `DONE` — proves Manager
  Loop cannot self-authorize around a blocking gate.
- **Simulated restart**: create a mission, dispatch and partially complete a phase, discard all
  in-memory/session context, then run `status.ts --json` cold and confirm it reconstructs
  everything listed in §3.1 correctly.
- `AgentGoal` boundary: a test asserting phase/mission completion logic never reads
  `AgentGoal.status`.

## 11. Dogfood mission

Mission: finish the two genuinely unfinished threads found stashed on
`feat/p7c-pr122-remediation` (confirmed additive to `main`, not superseded by PR #122):
statistical-correctness fixes to `lib/experiments/qualityOperations.ts` (per-metric
directionality, per-metric comparisons, corrected z-values up to 10 comparisons, NaN-date
guards, a replay-detection key fix), and the unified ops-readiness dashboard refactor
(`UnifiedOpsDashboard` + `app/admin/ops/readiness`), which is currently broken as stashed —
it references `lib/ops/operationalSnapshot.ts` and `lib/ops/operationalSources.ts`, neither of
which exists anywhere in the repository.

The actual phase decomposition is produced by a real Manager session run against this mission,
not pre-scripted in this design doc. At minimum one phase must run end-to-end through the full
protocol (dispatch → work → evidence → checkpoint → review → accept) to satisfy the Definition
of Done for Sub-project 1.

## 12. Explicitly out of scope (Sub-project 1)

No new sandboxed coding-agent runtime. No always-on orchestration server. No stall-policy
engine (only the data surface for one — §4). No Mission Control UI. No bounded-parallel-worker
system. No curriculum-specific mission templates. No change to `lib/agents/`'s existing
harness or its production agents. No fix to the `AUTONOMOUS_WORKFLOW_RUN` SQS/worker no-op path
— irrelevant to this design since resume is DB-driven via a session re-reading state, not
worker-driven via a queue.
