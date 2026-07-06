# Sprint 6.0 — Agent Platform Foundation (Design)

**Date:** 2026-07-06
**Status:** APPROVED (Option 1 refined). Decomposed into sub-sprints 6.0a–6.0d.
**Scope constraint:** No user-facing agent ships in any 6.0 sub-sprint. Echo agent only, admin-only, for harness validation.

---

## 1. Context & the decision that shaped this design

The original spec read as greenfield. Investigation showed it is not. Two pre-existing
"Agent" model families exist, with **opposite production status**:

| Family | Models | Prod status (2026-07-06) | Nature |
|---|---|---|---|
| **A — generic LLM logging** | `Agent`, `AgentTask`, `AgentMetric` | **LIVE** — Agent=2, AgentTask=18, AgentMetric=9; last write 2026-07-02 (`tutor-agent`) | Crude per-call log used by `lib/ai/tutor-agent.ts` + `lib/ai/homework-grader.ts`. ⚠️ **No migration exists** — schema drift (created via `db push`). |
| **B — Autonomous OS** | `AgentRun`, `AgentDecision`, `ActionExecution`, `ApprovalRequest`, `WorkflowRun` | **DEAD** — 0 rows in every table; no `WorkflowRun` ever created | 101-file rules-based governed-action/detector/approval engine (`lib/autonomous/`). 106 app importers, 5 crons. **Never calls an LLM.** |

**Approved architecture — Option 1 refined:**

- Build the genuinely-new LLM platform in a fresh **`lib/agents/`** tree.
- **Reuse the LIVE cross-cutting primitives** (do NOT rebuild):
  - `routedCompletion` — all LLM calls
  - `promptRegistry` — system prompts (loaded from file, registered at module load)
  - `serverFlags` pattern — kill switches
  - `logAudit` — audit trail
  - `withDbWriteThrottle` — write rate limiting
  - `hasPermission` / `assertPermission` / `requireRole` — authz
- **Do NOT touch Family B** (`lib/autonomous/`, `AgentRun`/`actionRegistry`/`escalationService`/`WorkflowRun`). It is dead, governance-shaped, LLM-less; entangling it resurrects dormant code against the 3,600+ test baseline. Build `EscalationQueue` fresh and simple.
- **Do NOT touch Family A** in 6.0 (`Agent`/`AgentTask`/`AgentMetric`). Design `AgentInvocation` as a *superset* so tutor-agent/homework-grader can migrate onto it in **6.1+**. The Family-A schema-drift is logged as a separate follow-up.
- New model names (`AgentInvocation`, `AgentGoal`, `AgentCostAccounting`, `EscalationQueue`) are all **free names** — no hard collision. The only overlap is conceptual (two "Agent" notions), resolved by namespacing code agent *definitions* as `AgentDefinition` in `lib/agents/`.

## 2. Defining technical constraint — prompted tool-calling

`routedCompletion` returns a **plain string** (`RouterResult.content`); it exposes **no native
tool/function-calling** (no `tools` param, no `tool_calls`). Since the constraint is to route all
LLM calls through `routedCompletion`, the runtime implements **prompted JSON tool-calling**:

- System prompt describes available tools (name, description, JSON input schema) and instructs the
  model to reply with **either** a tool call `{"action":"tool","tool":"<name>","args":{...}}`
  **or** a final answer `{"action":"final","response":"..."}`.
- Runtime calls `routedCompletion({ responseFormat: "json", ... })`, parses the JSON, and either
  dispatches the tool (validate args via the tool's Zod `inputSchema`, run `handler`, append result
  to conversation state, loop) or returns the final response.
- Malformed JSON → one repair retry, then error/escalate.

This keeps us provider-agnostic (Groq/OpenAI/Grok all route through the same path) and is testable
without live LLM calls (mock `routedCompletion`).

## 3. Sub-sprint decomposition (each independently gated)

- **6.0a Foundation** — data models, `AgentRegistry`, `ToolRegistry`, basic runtime loop, echo agent end-to-end, `/admin/agents/invocations` log. *(this doc's detailed scope)*
- **6.0b Runtime completion** — input/output moderation, translation layer, cost-enforcement middleware, kill-switch integration, dev SMS simulator.
- **6.0c Goals & triggers** — `AgentGoal` state machine, `AgentScheduler` (cron), `AgentTrigger` (Prisma middleware event bus), human resume.
- **6.0d Admin + test harness** — full `/admin/agents` dashboard, record-and-replay, behavior assertions, cost-cap tests.

**Gate per sub-sprint:** `npm test` green (baseline 3,600+), `npx tsc --noEmit` 0 errors,
`npm run build` green, migration applied to prod, deploy READY, in-prod verification. Do not start
the next sub-sprint until the previous gates green.

---

## 4. Sprint 6.0a — detailed scope

### 4.1 Data model (Prisma, all additive; migration `20260706_000001_agent_platform_foundation`)

All four models from the spec are added now (even though goals/escalation are exercised in later
sub-sprints) so the migration is applied once and the platform schema is stable.

```
model AgentInvocation {
  id               String   @id @default(cuid())
  agentName        String
  agentVersion     String
  goalId           String?                    // FK-by-id to AgentGoal (nullable)
  userId           String?                    // null if system-triggered
  triggeredBy      String                     // USER | SCHEDULE | EVENT | GOAL_CONTINUATION
  input            Json
  output           Json?
  toolCalls        Json                        // array of tool-call records (default [])
  llmTokensIn      Int      @default(0)
  llmTokensOut     Int      @default(0)
  llmCostUSD       Float    @default(0)        // 4+ decimal precision required
  toolCostUnits    Int      @default(0)
  latencyMs        Int      @default(0)
  status           String                      // SUCCESS | FAILURE | ESCALATED | TIMEOUT | COST_CAPPED | FEATURE_DISABLED
  errorMessage     String?
  escalationReason String?
  createdAt        DateTime @default(now())
  goal             AgentGoal? @relation(fields: [goalId], references: [id])
  @@index([agentName, createdAt])
  @@index([userId, createdAt])
  @@index([goalId])
}

model AgentGoal {
  id                   String   @id @default(cuid())
  agentName            String
  initiatedBy          String                  // userId or "system"
  goalDescription      String
  status               String   @default("OPEN") // OPEN|IN_PROGRESS|PAUSED_FOR_HUMAN|PAUSED_FOR_SCHEDULE|COMPLETED|FAILED|CANCELLED
  state                Json     @default("{}")
  pauseReason          String?
  pauseUntil           DateTime?
  humanReviewRequired  Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  completedAt          DateTime?
  invocations          AgentInvocation[]
  @@index([status, updatedAt])
  @@index([initiatedBy])
}

model AgentCostAccounting {
  id                String   @id @default(cuid())
  agentName         String
  date              DateTime @db.Date
  totalInvocations  Int      @default(0)
  totalLlmCostUSD   Float    @default(0)
  totalToolCostUnits Int     @default(0)
  uniqueUsers       Int      @default(0)
  @@unique([agentName, date])
}

model EscalationQueue {
  id           String   @id @default(cuid())
  agentName    String
  invocationId String
  goalId       String?
  userId       String?
  reason       String
  priority     String   @default("MEDIUM")   // LOW | MEDIUM | HIGH
  assignedTo   String?
  status       String   @default("OPEN")     // OPEN | IN_PROGRESS | RESOLVED | CLOSED
  createdAt    DateTime @default(now())
  resolvedAt   DateTime?
  resolution   String?
  @@index([status, priority, createdAt])
}
```

Enum-like fields are stored as `String` (matching the repo's prevailing convention — e.g.
`imageGenerationStatus`, autonomous statuses — rather than Postgres enums) with the allowed values
constrained in TypeScript.

### 4.2 `lib/agents/` module layout

```
lib/agents/
  types.ts              // AgentDefinition, ToolDefinition, RunContext, RunResult, cost/status unions
  registry.ts           // agentRegistry: Record<string, AgentDefinition>; getAgent(), listAgents()
  toolRegistry.ts       // toolRegistry: Record<string, ToolDefinition>; getTool(), listTools(), tools-for-agent
  prompts.ts            // loads agent system prompts from lib/agents/prompts/*.md, registers into promptRegistry
  prompts/echo.md       // echo agent system prompt (file-based, per spec)
  runtime.ts            // runAgent(agentName, userInput, ctx): the execution loop
  costAccounting.ts     // recordSpend(): upsert AgentCostAccounting; accurate to >=4 decimals
  invocationLog.ts      // persistInvocation(): write AgentInvocation via withDbWriteThrottle + logAudit
  agents/echo.agent.ts  // echo AgentDefinition (test-only, admin-only, flag-gated)
  tools/echo.tool.ts    // echo-tool ToolDefinition (returns its input)
  flags.ts              // agent kill-switch helpers following serverFlags pattern
```

`AgentDefinition` fields (spec §D1): `name, description, systemPromptKey, toolAllowlist[],
llmModel?, temperature?, maxTokens, costLimits{perInvocationUSD, perUserPerDayUSD, perDayTotalUSD},
featureFlag, rolesAllowed[], version`.

`ToolDefinition` fields (spec §D1): `name, description, domain, inputSchema (Zod), outputSchema
(Zod), handler, auditTag, estimatedCostUnits, requiresAuth (roles)`.

### 4.3 Runtime loop (6.0a subset)

`runAgent(agentName, userInput, ctx)`:
1. `getAgent` from registry → 404-equivalent error if missing.
2. **Kill-switch check** (`flags.ts`) → if disabled, persist invocation `status=FEATURE_DISABLED`, return blocked.
3. **Role check** — `ctx.userRole` in `agent.rolesAllowed` (echo agent = admin only).
4. Build system prompt (`getSystemPrompt(agent.systemPromptKey)`) + tool descriptions from allowlist.
5. Loop (max depth default 20):
   - `routedCompletion({ responseFormat: "json", maxTokens, aiUsage })`
   - accumulate `inputTokens/outputTokens/estimatedCostUSD`
   - parse JSON: tool → validate args (Zod) → run handler → append result → loop; final → break.
   - **Per-invocation cost cap**: if accumulated `llmCostUSD` > `costLimits.perInvocationUSD`, break with `status=COST_CAPPED`.
   - Timeout default 60s (wall clock) → `status=TIMEOUT`.
6. Persist `AgentInvocation` (tokens, cost to ≥4 decimals, toolCalls[], latency, status) via `withDbWriteThrottle`; `logAudit`.
7. `recordSpend` → upsert `AgentCostAccounting` for `(agentName, today)`.
8. Return `RunResult`.

*Deferred to 6.0b/c:* moderation, translation, per-user/per-day cost enforcement (accounting is
written in 6.0a; the pre-invocation enforcement middleware lands in 6.0b), goal continuation.

### 4.4 Echo agent (test-only harness validation)

- `echo` agent: flag `AGENT_ECHO_ENABLED`, `rolesAllowed: ["admin"]`, allowlist `["echo-tool"]`,
  tiny cost limits. System prompt (from `prompts/echo.md`) instructs: call `echo-tool` once with the
  user input, then return its result as the final answer.
- `echo-tool`: `inputSchema z.object({ text: z.string() })`, returns `{ echoed: text }`,
  `estimatedCostUnits: 1`, `auditTag: "agent.tool.echo"`.
- Proves: registry lookup, kill switch, role gate, LLM→tool→LLM loop, invocation persistence, cost
  accounting, admin visibility.

### 4.5 Admin surface (6.0a subset)

- `GET /api/admin/agents/invocations` — `assertPermission`-guarded; filters (agentName, status,
  userId, date range); returns paginated `AgentInvocation` rows.
- `POST /api/admin/agents/echo/run` — admin-only test-invocation endpoint that calls
  `runAgent("echo", ...)`. Gated by `AGENT_ECHO_ENABLED`.
- `/admin/agents/invocations` page — server component listing invocations with drill-down into one
  invocation (input, output, toolCalls, tokens, cost, status). Link added to `AdminNav`.
- New permission `AGENT_PLATFORM_VIEW` in `lib/permissions.ts` (ADMIN + platform admin).

### 4.6 Testing (6.0a)

- `agentRegistry` / `toolRegistry` — registration, lookup, allowlist enforcement, duplicate-name guard.
- `runtime` — with `routedCompletion` mocked: happy path (LLM→tool→LLM→final), max-depth stop,
  malformed-JSON repair, cost-cap stop, kill-switch block, role-denied block.
- `costAccounting` — upsert increments; 4-decimal precision preserved.
- `invocationLog` — persists correct shape; audit called.
- echo agent end-to-end (mocked LLM) — invocation row written with `status=SUCCESS`, one tool call.
- Admin route — permission gate; filter behavior.

### 4.7 6.0a gate

`npm test` green (≥ baseline + new), `npx tsc --noEmit` clean, `npm run build` green, migration
applied to prod, push to main, Vercel READY, and in-prod verification: echo runs via admin endpoint,
invocation appears in the log, cost accounting updated, kill switch blocks when toggled.

---

## 5. Follow-ups logged (out of 6.0 scope)

1. **Family-A schema drift** — add a reconciling migration for `Agent`/`AgentTask`/`AgentMetric` (6.1+).
2. **Family-A migration onto `AgentInvocation`** — retire the crude logger once superset is proven (6.1+).
3. **Fate of dead `lib/autonomous/`** — separate decision: activate or prune.
4. **High-risk tool → governed-action delegation** — if `lib/autonomous` is ever activated, LLM tools with real-world effects could route through it (6.1+).
