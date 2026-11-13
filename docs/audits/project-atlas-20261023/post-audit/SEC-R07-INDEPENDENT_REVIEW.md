# SEC-R07 independent implementation review

Verdict: PASS for the examined code-side absolute-stop precedence, pre-dispatch checks and transactional database-control auditing. Full operational restoration assurance remains conditional on documented environment-change audit and rollout evidence. This is not approval to enable, merge or deploy an agent, and it does not establish production configuration.

RED test commit supplied by the primary executor: `bd7b2ae570442abd5d8a44ced3ffcc8622111c8e`, 9 failures and 1 pass. Primary executor reports 10 GREEN checks. Related suites and TypeScript remain separate executor evidence. This reviewer inspected the actual implementation/test diff without rerunning heavy jobs, providers or database calls and changed only this review file.

## Stop and dispatch assessment

`getAgentEmergencyStop` gives the global `AGENT_PLATFORM_EMERGENCY_DISABLED` exact trimmed true value highest precedence, followed by exact trimmed false for the named feature flag. A database true override cannot defeat either stop. Unset flags retain intentional DB override behavior; absent override remains default-off. This preserves dashboard override capability without treating unset as explicit emergency denial. Exact lowercase parsing follows the existing convention; operators must use the documented values.

`resolveAgentActivationState` checks absolute stop before database lookup and uses the same shared activation helper after lookup or fallback. A database outage cannot bypass either environment stop. `isAgentEnabled` also uses this stop helper, so paths that use only the environment helper inherit the global stop.

`runScheduled` and `emitAgentEvent` now resolve effective state before invoking context builders. Database false overrides therefore prevent scheduled/triggered context preparation even when the ordinary environment flag is true. `runAgent` retains its own resolver check, so a stop occurring after a context builder starts can still deny the subsequent invocation. The diff changes runtime only in its explanatory comment; no role, moderation, cost or tool authority boundary is removed.

The admin stats function computes effectiveEnabled and effectiveStateSource with the same pure helper and actual control values. This adds a source field while retaining the existing response fields. It exposes source in returned data, not necessarily a visible dashboard label. Dashboard failure behavior during database outage differs from runtime fallback because stats still reads controls/counters directly; do not claim an outage-proof view.

## Database control audit

`setAgentControl` requires a nonblank actor and performs previous-state read, upsert and `agent.control.updated` AuditLog insertion inside one Prisma transaction. An audit-write error propagates and the transaction prevents the requested restore from committing without its corresponding audit. The current toggle route retains `requirePlatformAdmin` and passes its authenticated user ID. No source in the reviewed diff allows request-supplied role or actor identity to replace that route check.

The transaction records attempted effective-control changes, including setting an override true while an absolute stop remains active. That true override is not itself authorization to bypass the environment stop. The mocked rollback test exercises the expected callback failure contract; actual database transactional semantics are not independently integration-tested here.

## Material operational limits

1. **DB outage fallback retains availability semantics.** With no absolute stop and ordinary env flag true, a failed control lookup enables from the env fallback even if the last stored DB override was false. This behavior preexists the repair and is now labeled env_fallback by the resolver. With env unset/false, fallback remains disabled. Operators needing an absolute outage-safe stop must use global true or per-agent false, not only a DB false override. The repair must not be described as universally failing closed on control-store failure.
2. **Environment restoration is outside the new transactional audit.** Clearing global emergency true or removing per-agent false can restore a preexisting DB true override. That environment change does not call setAgentControl and creates no application audit by this patch. Therefore the acceptance phrase restore is audited is established for DB-control restoration only. Environment restoration needs an authorized deployment/configuration-change audit that identifies actor, target, old/new value, approval and effective rollout. Without that evidence, full operational restoration acceptance is BLOCKED; do not silently equate an ordinary deployment log with proof of approval.
3. **In-flight execution is not cancelled.** Checks govern entry and dispatch. Already-started model calls, tool handlers and context builders are not interrupted, and running instances only see the environment configuration supplied to them. Environment deployment propagation is not an immediate process-wide kill mechanism. Stop handling after entry would require separate cancellation/checkpoint design and is not claimed here.
4. **Scheduling behavior now honors overrides consistently.** A true DB override with an unset schedule/event flag may now permit dispatch that the old environment-only precheck skipped, while false overrides now suppress it. This is consistent with the requested effective-state contract, but it is a behavior change; verify actual controls under separate authorization before rollout. No production controls were read or changed here.

## Test quality and follow-up evidence

`emergency-disable.test.ts` uses the real resolver, runtime, scheduler, trigger dispatcher and stats with a synthetic registered agent. Tests prove global/per-agent precedence, unset compatibility, no completion call after global stop, no context preparation after stop or DB disable, stats source, attributed control auditing and rollback on audit failure. Input/output/providers and persistence are mocked; no real agent is enabled.

Useful additional bounded tests are the DB-outage matrix with global true, per-agent false, env true and env unset; direct source-label assertions for env_fallback; and a positive context-dispatch control under no stop. These cover stated semantics without expanding into deployment or database access. Existing related tests must reflect the resolver dispatch change rather than masking it by mocking only the old flag helper.

No blocking bypass of the requested absolute stops was found in the examined diff. Before CoS acceptance, record final related-check/TypeScript results and exact commit hashes, and state the environment-restoration audit and in-flight limits in the handoff. Finding remains OPEN until exact-commit acceptance; deployed posture remains UNKNOWN.

## Version binding

Source HEAD at review `bd7b2ae570442abd5d8a44ced3ffcc8622111c8e` with uncommitted implementation. SHA256 bindings:

- `lib/agents/flags.ts`: `4f6ff7d5a903132e73cc9f09c835d98ca0a0105fdc0d6e23df5d92b4da9ee370`.
- `lib/agents/control.ts`: `b20fb5ef4dabdb56c3b0a5d794a3911e7fb6481640e6b712ae978a592ed14348`.
- `lib/agents/scheduler.ts`: `1edcbac849611f0e96d0bb00c19b51ca228750ee4474c6399db54febc8cd9644`.
- `lib/agents/triggers.ts`: `503e8be32026c228c8d887d24184cce65df7e3d9842899432785cfbf11f16169`.
- `lib/agents/runtime.ts`: `dd0ea94acc3898a86d23e4cff819b660cc9554c6e2e351a0b766f500249cfe9c`.
- `lib/agents/admin/stats.ts`: `39fed9e62235ad651a07ce2f70734080963f841aaa06c69a89ceba4a178211d9`.
- `docs/audits/project-atlas-20261023/post-audit/tests/emergency-disable.test.ts`: `2af4ebca38fc98b67823e355a2581c6eaedbc70f4fe63679e23b15ec1cb479ba`.
