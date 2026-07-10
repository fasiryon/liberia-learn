# Advisor / Orchestrator Escalation Contract

Standing context for LiberiaLearn sprints. Advisor mode is the default. Orchestrator mode is used only when work is clearly parallel. Every sprint dispatch inherits this file.

## Modes

**Advisor (default).** A single executor runs the work under a defined escalation contract. It stops and requests review at the named decision points below, and proceeds without escalation everywhere else.

**Orchestrator (clearly parallel work only).** Work shards into independent chunks with a synthesis step. The planner produces chunk definitions, a per-chunk spec, a synthesis contract, and quality-gate criteria. Workers receive a chunk spec plus shared context (schema, style, existing code) and a deliverable format, with no cross-chunk coordination (a worker that discovers cross-chunk impact escalates to the planner, not to another worker). The planner collects outputs, runs the quality gate, assembles the deliverable, and reports the chunk-quality distribution.

## Advisor escalation points (STOP and request review if)

1. A schema change touches any table currently in production use. Safe to add or alter without review: the agent-platform tables (AgentInvocation, AgentGoal, AgentControl, EscalationQueue, AgentCostAccounting). Require review before changing: Student, Guardian, User, StudentProgress, and any table serving live users.
2. Debugging exceeds 45 minutes of investigation without an identified root cause.
3. A conventional carry-forward pattern must be broken for a specific reason (see Carry-forward rules).
4. Projected cost per invocation exceeds $0.005 (signals that model or tool routing needs reconsideration).
5. A decision would require rewriting more than 200 lines of prior work if the wrong path is taken.
6. Sprint 6.1 Guardian agent additions: the identity-verification flow, the guardian phone-number update flow, multi-guardian household edge cases, per-guardian SMS cost accounting, and escalation-queue integration for safeguarding / child-safety concerns.

For everything else, proceed without escalation. Record any escalation (reason plus reviewer response) in the sprint report.

## Confirmed pattern gates (2026-07)

- Sprint 6.0 bundled deploy verification: advisor, 45-minute investigation cap; escalate on root-cause-not-found, a fix that touches a production-live table, or a broken carry-forward rule.
- Sprint 6.1 Guardian agent: advisor, with the five named Guardian escalation points above.
- End-of-features curriculum generation (approximately 5,905 lessons times media types, roughly 17,000 generation tasks): orchestrator, sharded by grade and subject, planner quality-gates each chunk.

## Carry-forward rules (apply in every session)

1. contentId in URLs, not scheduledWork.id (sw.id).
2. Hero content lives in payload.body.
3. DIRECT_URL (port 5432) for batch writes of 25 or fewer; pooler (port 6543) for production reads.
4. .trim() on Vercel env vars (learned from the AI tutor CRLF bug).
5. No em dashes in any output or file.

## How "escalate to Fable" maps when a single model executes directly

When one model is executing (no separate Fable process), "escalate to Fable" means: stop, surface the decision to the human with the escalation reason and the options, and wait for a call. Optionally spawn a Fable-model review agent for a second opinion. Never proceed silently past a named escalation point.
