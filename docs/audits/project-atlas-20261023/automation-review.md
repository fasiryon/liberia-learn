# Automation review

Pinned source: `887f23ecc`. Static discovery verifies code/configuration, never production activation. The canonical machine inventory is `automation-review.json`; reports should derive counts and rows from it.

## Inventory counts

- 8 built-in registered agents: 7 LLM definitions including test-only echo, and Ops Sentinel whose cron path is deterministic.
- 1 deterministic test-only goal handler, goal-echo.
- 27 cron routes with matching Vercel schedule declarations.
- 10 GitHub workflows, including disabled PR Triage placeholder.
- 1 separately guarded MergeOps controller.
- 1 Anthropic OS daemon, 1 Claude SDK development scanner, and 1 n8n template with unknown live state.
- 26 developer/OS instruction personas or workflow templates; these are not independent application agents.

## Decisions

Keep bounded shared agent runtime, direct sweep entry points, guardian linkage checks and human review boundaries. Integrate shared usage and event evidence across OS automation and application runtime. Keep MergeOps write authority disabled while using read-only observations. Consolidate historical authoring personas by mapping their contracts to current Content Factory policy before reuse. Verify n8n deployment and node compatibility externally.

## Concrete findings

### AUTO-R1 P1 HIGH

Two scheduled handlers use x-cron-secret/query secret while repository retry and remaining cron handlers use Authorization Bearer. Scheduled leaderboard refresh and demo timetable refresh return 401 under Bearer-only scheduler.

Evidence: `app/api/cron/rebuild-leaderboards/route.ts:7`, `app/api/cron/refresh-demo-schedule/route.ts:27`, `vercel.json`, `lib/agents/opsSentinel/actions.ts:35`. Confidence: high for code mismatch; provider delivery unverified.

Action: Standardize fail-closed Bearer guard and verify scheduler invocation without query credentials. Owner: Platform operations. Complexity: S. Acceptance: Both routes accept authorized Bearer and reject missing/incorrect auth; captured scheduler success and intended data effects in isolated environment.

### AUTO-R2 P2 MEDIUM

Direct Anthropic watcher starts a request for every add event and marks DONE after output without persistent claim or shared accounting. OS request bursts create uncontrolled concurrent provider calls; duplicate work after crash.

Evidence: `os-vault/daemon/watcher.mjs:34`, `os-vault/daemon/watcher.mjs:51`, `os-vault/daemon/watcher.mjs:93`. Confidence: high static.

Action: Reuse shared quotas/usage ledger, bounded concurrency, deterministic request identity and crash-safe claims. Owner: Chief of Staff automation owner. Complexity: M. Acceptance: Burst test respects concurrency/quota; restart does not duplicate completed work; provider calls have correlated cost records.

### AUTO-R3 P2 MEDIUM

registerSchedule/registerTrigger have no application registration calls; only goal-echo goal handler is registered. Agent event/schedule abstractions can be mistaken for integrated product automation.

Evidence: `lib/agents/scheduler.ts:25`, `lib/agents/triggers.ts:23`, `lib/agents/goals/goalEcho.ts:13`, `lib/agents/bootstrap.ts`. Confidence: high tracked code search.

Action: Keep helpers dormant and document supported direct sweeps; add registrations only for a measured use case. Owner: Agent platform owner. Complexity: S. Acceptance: Registry exposes truthful runtime entries and dormant helpers are not presented as live automation.

### AUTO-R4 P2 MEDIUM

Ops Sentinel auto-retry map covers only agents-tick/check-dlq/check-ai-budget among 27 configured crons. Ops health can appear broader than monitored workflows.

Evidence: `lib/agents/opsSentinel/actions.ts:28`, `lib/ops/cronHeartbeat.ts`, `vercel.json`. Confidence: high static.

Action: Define cron ownership, expected cadence and heartbeat coverage; review retry idempotency per job. Owner: Platform operations. Complexity: M. Acceptance: Every scheduled job has owner, last-success telemetry and alert policy; no retries enabled without idempotency proof.

### AUTO-R5 P3 LOW

Agent definitions declare temperature but runtime routedCompletion call does not forward it. Agent prompt settings convey false precision.

Evidence: `lib/agents/agents/liberialearn-family.agent.ts:10`, `lib/agents/runtime.ts:149`. Confidence: high static.

Action: Either route supported sampling settings with evaluations or remove unsupported declarations. Owner: AI platform owner. Complexity: S. Acceptance: Effective provider parameters are logged and match documented agent configuration.

### AUTO-R6 P2 MEDIUM

Weekly RAG evals receives repository DATABASE_URL/DIRECT_URL and EVAL_SCHOOL_ID secrets; target isolation not established by YAML. Weekly evaluation may target shared student database or produce unrepresentative conclusions.

Evidence: `.github/workflows/evals.yml:15`, `scripts/run-evals.ts`. Confidence: high for configured inputs; target unknown.

Action: Verify dedicated eval DB/tenant, fixture provenance and latest run/artifact before trusting eval results. Owner: QA and platform operations. Complexity: S. Acceptance: Attested isolated target; commit/dataset hash in artifact; no production student writes; outcome reports identify dataset limitations.

## Limits and handoff

The inventory distinguishes cron dispatchers, logical agents, developer personas and externally configured workflows. Counting every entry as an AI agent would be misleading. No last production run was observed. Git history establishes provenance only. An unused registration API is not proof a module is globally unreachable. Historical references were sampled by targeted git log, rather than reading every branch. Chief of Staff should use the canonical registry to review OS automation ownership and reconcile review contracts without changing its owned documents.


## AUTO-R7 P1 high: read-only scanner shell authority

The development scanner in tools/agent-scan/scan.mjs:59-82 requests Bash despite read-only prompt instructions and has no command-level restrictions in source. Effective SDK option enforcement is unverified. Before reuse, constrain tool permissions and prove attempted mutation is denied in a credential-free fixture. No scanner was executed during this audit.
