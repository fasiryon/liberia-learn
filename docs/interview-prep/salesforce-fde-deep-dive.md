# LiberiaLearn — FDE Interview Deep-Dive Brief
### Tailored to: Salesforce Forward Deployed Engineer (agentic AI, customer-embedded delivery)

> How to use this: read the **2-minute narrative** until you can say it cold. Then internalize the **JD→story crosswalk** — that's the map from "what they ask" to "what you say." Everything else is depth you pull from on demand.

---

## 0. The 2-minute narrative (say this when they say "walk me through it")

> "LiberiaLearn is a national K-12 learning platform I designed and built for one of the hardest deployment environments imaginable — Liberia: low bandwidth, intermittent power, feature phones, and a real institutional customer, the Ministry of Education, who needs governance and national reporting.
>
> The core problem is that you can't just ship a normal web app there. So the whole system is engineered around constraints: it's **offline-first** with a service-worker sync queue, it falls back to **SMS** for guardians without smartphones, and it's **multi-tenant** so each school's data is isolated while the Ministry gets aggregate dashboards.
>
> On top of that I built an **AI layer**: an LLM 'curriculum factory' that generates and grades lessons, a **RAG** pipeline for grounded tutoring, and most recently an **agent platform** — a harness for LLM agents with tool-calling, moderation, cost governance, kill switches, long-running goals, and an admin observability dashboard. No user-facing agent ships yet; I built the *platform* first because agents are security- and cost-sensitive and I wanted the guardrails in place before any of them touch a student.
>
> It's a production-grade system — deployed on Vercel, ~3,800 tests, TypeScript strict, real Postgres — currently at the pre-pilot stage. The engineering I'm proudest of is the judgment under constraints: cost caps on every AI call, prompted tool-calling because the model router had no native function-calling, fail-open moderation so a classifier outage never bricks a lesson. That trade-off-under-ambiguity work is exactly what I want to keep doing as an FDE."

**Why this works for Salesforce FDE:** it hits *agentic AI*, *customer/enterprise governance*, *production*, *builder mindset*, and *engineering judgment* in 120 seconds — and it's honest about maturity (pre-pilot), which builds credibility.

---

## 1. What it is / the customer framing (the FDE angle)

- **Product:** a full learning platform — students get scheduled lessons, quizzes, an AI tutor, offline packs; teachers get class dashboards, AI grading assist, lesson recording; guardians get SMS progress digests; the **Ministry of Education (MOE)** gets national oversight — coverage, delivery compliance, live dashboards.
- **The "customer" is institutional.** Frame the MOE the way an FDE frames a customer: they have goals (national curriculum coverage, measurable outcomes), constraints (low-resource schools), and non-technical stakeholders who need dashboards and reporting, not raw data. Multi-tenancy, a permissions matrix, audit immutability, and governance exports all exist *because the customer is a government*.
- **Deployment reality = the FDE thesis.** This isn't a toy in an idealized cloud. It's engineered for 2G, offline, feature phones, unreliable power, and a customer who needs to *trust* it. That's "real code, real environments, measurable business impact."

---

## 2. Architecture at a glance

**Stack:** Next.js (App Router, RSC) · TypeScript (strict) · Prisma ORM + Postgres (Supabase) · Redis (Upstash) cache · Vercel (serverless + cron) · Vitest (~3,800 tests) · Sentry.

**AI stack:** a **model router** (`routedCompletion`) over OpenAI / Groq / Grok with tiered routing (fast vs smart), per-call cost tracking, circuit breakers, and budget guards · **RAG** (dense embeddings + BM25 sparse + Reciprocal Rank Fusion + Cohere rerank) · **Judge0** sandbox for code grading · **ElevenLabs** audio · a **prompt registry** (no hardcoded prompts — every prompt is versioned + hashed).

**External integrations (the "integrate with customer systems" muscle):** Africa's Talking (SMS), Supabase (DB + storage), Upstash (Redis), Vercel Blob, Google SSO with an invite-gate.

**Mental model to draw on a whiteboard:**
```
Feature phone ──SMS──┐
Browser (offline SW) ─┼─> Next.js (RSC + API routes, multi-tenant auth/permissions)
                      │        ├─> Prisma ──> Postgres (school-scoped)
                      │        ├─> Redis cache (dashboards, 30-60s TTL)
                      │        ├─> routedCompletion ──> OpenAI/Groq/Grok  (cost-tracked)
                      │        ├─> RAG (BM25 + dense + RRF + Cohere)
                      │        └─> Agent platform (registry→runtime→tools, guardrails)
                      └─> Vercel Cron ──> pipelines (audio, digests, agent goal tick)
```

---

## 3. ⭐ The agent platform — your centerpiece for THIS role

This is the single most JD-relevant thing you've built. The JD literally lists "prompts, reasoning, tool calls, integration, observability, KPI dashboards." You built a harness for all of it. Know it cold.

**Design decision that frames everything: I built the *platform*, not an agent.** Agents are security- and cost-sensitive, so the first deliverable is guardrails. A test-only "echo agent" validates the harness end-to-end; no student-facing agent ships until the platform is proven. *(This is exactly how you'd de-risk an agentic deployment inside an enterprise — say that.)*

**The pieces (and why each exists):**

1. **Code-based registries (agents + tools).** Agents and tools are declared in code, not a database — "adding one requires a commit and review." Each tool carries a **Zod input/output schema**, a domain, an audit tag, a cost estimate, and an allowlist of roles. *Why code not DB: agents are a security surface; you want them in code review, not editable at runtime.*

2. **Prompted JSON tool-calling** (the best technical story here). The model router returns a **plain string — no native function-calling.** So I implemented tool-calling in the prompt layer: the system prompt describes the available tools and a strict reply contract — the model must return **either** `{"action":"tool","tool":"…","args":{…}}` **or** `{"action":"final","response":"…"}`. The runtime parses the JSON, **validates args against the tool's Zod schema**, dispatches the handler, appends the result to the conversation, and loops. Malformed JSON → **one repair retry**, then fail. I verified gpt-4o-mini emits the exact contract. *This is provider-agnostic and testable without live LLM calls.*

3. **The execution loop + stop conditions.** Max tool-call depth (default 20), a **per-invocation cost cap** checked as cost accrues, a wall-clock timeout, and terminal statuses: `SUCCESS / FAILURE / ESCALATED / TIMEOUT / COST_CAPPED / FEATURE_DISABLED`. Every run is persisted as an `AgentInvocation` (tokens in/out, cost to 6 decimals, tool-call records, latency, status) — full observability.

4. **Moderation (input + output), fail-open.** Input is classified `SAFE/UNSAFE/UNCERTAIN` before any spend; UNSAFE blocks. Output is classified after generation; UNSAFE → **regenerate once** with a safety nudge → still UNSAFE → **escalate to a human queue** and withhold the response. Key judgment call: on a **classifier outage it fails *open* to UNCERTAIN** (logged, not blocked) — because bricking every lesson on a moderation-service blip is worse than the risk, for a K-12 education context. *(Great "trade-off" answer.)*

5. **Cost governance — three tiers.** Per-invocation (in the loop), **per-user-per-day**, and **per-day-total**, all enforced *before* the LLM is called, against a `AgentCostAccounting` ledger accurate to ≥4 decimals. This is the "measurable business impact / don't blow the budget in a customer env" muscle.

6. **Kill switches — two layers.** An env feature flag *and* a DB override (`AgentControl`) that the admin dashboard toggles at runtime; the runtime resolves `override ?? env`, failing safe to env on DB error. Every agent is **off by default.**

7. **Multi-language layer.** Detect language → translate inbound to English → run the agent in English → translate the response back. Cached per (text, source, target) to save cost.

8. **Long-running goals (agentic autonomy, done safely).** An `AgentGoal` state machine: `OPEN → IN_PROGRESS → PAUSED_FOR_HUMAN / PAUSED_FOR_SCHEDULE → COMPLETED / FAILED`. A goal takes **one step per tick** (a runaway guard caps total steps), can pause for human input (with a resume mechanism) or pause until a wake time. A Vercel cron "tick" advances due goals. *This is how you do autonomy without letting an agent spin unbounded in a customer's environment.*

9. **Scheduled + event-triggered agents.** A code schedule registry (agent + cron + context-builder) and an **event bus** (`emitAgentEvent`) with a **Prisma `$use` middleware factory** so an agent can fire on, e.g., `StudentProgress.created where score < 0.4`. Provided as an opt-in hook, deliberately *not* wired to a live model yet (blast-radius control).

10. **Observability dashboard.** `/admin/agents`: agents list + toggles + cost-this-week, a cost dashboard (daily/weekly/monthly + cost-per-invocation trend + highest-cost users), a goal browser, an escalation queue (assign/resolve), and a trigger monitor (success rate). Plus a **test harness**: deterministic scripted LLM, **record-and-replay** to catch behavior regressions, and behavior assertions (`assertToolCalled`, `assertEscalated`, `assertRefused`).

**One-liner to memorize:** *"I treated agents as a governance problem first and an intelligence problem second — registries in code, Zod-validated tool calls, three tiers of cost caps, dual kill switches, fail-open moderation, human-in-the-loop escalation, and full invocation observability — so that when a real agent ships, the guardrails are already load-bearing."*

---

## 4. The AI curriculum factory + RAG (prompt-engineering rigor)

The JD wants "explain why a prompt failed and what you'd change." You have real material:

- **Two-pass generation.** JSON-mode generation produced ~half the words of text-mode. So I split it: **Pass 1** (text mode) writes the rich lesson body; **Pass 2** (JSON mode) extracts only compact metadata. Body used verbatim. *Failure: JSON mode over-constrains prose. Fix: separate the "write" and "structure" concerns.*
- **The backwards quality gate.** A scaffold generator had a length-ratio gate (scaffold must be 20-40% of parent) that was **rejecting correct short scaffolds of long hard lessons.** *Failure: the heuristic encoded the wrong assumption. Fix: replaced the ratio with an absolute word floor.*
- **Models ignore "no input prompts."** Code-exercise generation kept emitting `input("Enter…")` despite instructions. *Failure: instruction-following isn't guaranteed. Fix: a deterministic post-processor (`stripInputPrompts`) rather than trusting the prompt.*
- **RAG grounding.** Answers must cite only retrieved `sourceId`s; the pipeline is hybrid (BM25 + dense, fused with RRF, reranked by Cohere) with graceful fallback when a key is missing. Evals track recall@5 for dense-only vs sparse-only vs hybrid.
- **Prompt registry.** No prompt is hardcoded in logic — each is versioned + hashed in a registry, so prompts are reviewable and diffable. *(This is a real "AI engineering rigor" signal.)*

---

## 5. Real-world constraints → engineering (the deployment story)

| Constraint | What I built |
|---|---|
| 2G / low bandwidth | Auto-detected low-bandwidth mode; offline lesson packs; RSC to minimize client JS |
| Offline / flaky connectivity | Service worker + `idb-keyval` submission queue, network-first-then-queue, idempotency keys, sync manager with a pending badge |
| Feature phones (no smartphone) | SMS layer (Africa's Talking): two-way quiz, guardian digests, STOP handling; a dev SMS simulator for testing without a live number |
| Government customer | Multi-tenant scoping, RBAC permissions matrix, **append-only audit log (DB triggers)**, governance exports with PII gating |
| AI cost in a low-margin context | Model router with fast/smart tiers, budget guards, circuit breakers, per-feature cost tracking, agent cost caps |
| No local DB access (Supabase) | Hand-authored, idempotent, additive migrations; pooled URL for reads, **direct URL for writes** (pooled write path stalls) |

---

## 6. Key decisions + trade-offs (interviewers live here)

- **Prompted tool-calling vs native function-calling** — chose prompted because the router is multi-provider and has no native tools; trade-off: more parsing/repair logic, but provider-agnostic and unit-testable. *(You built a small router-agnostic function-calling layer — that's a strong systems story.)*
- **Registries in code, not DB** — reviewability + security over runtime flexibility.
- **Fail-open moderation** — availability over strictness for an education context (with logging + human escalation as the backstop).
- **Build the platform before any agent** — de-risk the cost/safety surface first.
- **Two model families investigation (real FDE-style archaeology):** the codebase already had two "Agent" model families. I ran an investigation — queried prod, traced 106 importers — and found one was *dead* (0 rows ever) and one was *live but crude*. Rather than build on either, I designed a clean new platform and left both untouched, with a documented migration path. *(This is the "walk into a messy existing system, figure out ground truth, make a reversible call" story — pure FDE.)*
- **Deferred a $22 production redeploy** — pragmatic prioritization; verified every sub-sprint directly against the prod DB + real LLM via scripts instead, so correctness didn't depend on the deploy.

---

## 7. Observability, ops, cost (maps to "dashboards + KPI reporting")

- Ops health dashboard (DB/Redis health, error rates, AI spend by feature, queue depth + DLQ), alerting via email + SMS, an on-call runbook with 7 failure modes + rollback procedures.
- Agent invocation log + cost dashboard + escalation queue.
- ~22 Vercel cron pipelines (audio generation, guardian digests, leaderboard rebuilds, agent goal tick, cleanup jobs).

---

## 8. Data modeling (maps to "design integrations, not just consume them")

- Multi-tenant Postgres via Prisma; every query school/district-scoped.
- Rich domain: curriculum content, scheduled work, assessments, mastery records, adaptive prerequisites graph (~3,800 edges), league/competition, MOE submissions, agent invocations/goals/cost.
- Migrations are additive + idempotent (`IF NOT EXISTS`), applied manually because there's no local DB — a real integration/ops discipline.

---

## 9. Metrics / scale — BE HONEST (this protects your credibility)

**True today:** deployed to Vercel; ~3,800 automated tests; TypeScript strict, 0 errors; ~5,900 approved lessons generated; the agent platform verified end-to-end against prod (real LLM + real DB). **Pre-pilot** — not yet serving real students at scale. A **load test failed** at 2,000 VUs (p95 ~35s, ~81% errors) and I documented the bottlenecks (league-table collapse, token-fixture mismatch) as the pre-pilot gate. *Owning that failed load test is a strength, not a weakness — it shows you measure and you're honest.*

**Do NOT claim:** "in production serving X real students." Claim: "production-grade, deployed, pre-pilot, with a documented path to scale and a load test that surfaced the exact bottlenecks to fix."

---

## 10. ⭐ JD → LiberiaLearn crosswalk (the money table)

| JD requirement | Your story |
|---|---|
| Design agent intelligence: prompts, reasoning, tool calls, integration | The whole agent platform: prompted JSON tool-calling, Zod-validated tools, goal state machine |
| Own components end-to-end: architecture → deployed, validated, observable | Any sub-sprint: design doc → TDD → prod migration → prod verification → invocation dashboard |
| Hands-on with LLMs; explain why a prompt failed + what you'd change | Two-pass generation, backwards quality gate, `stripInputPrompts`, fail-open moderation |
| Evaluate AI outputs with engineering rigor | RAG evals (recall@5), quality gates, moderation classifiers, the record-and-replay test harness |
| Agent performance dashboards + KPI reporting | `/admin/agents` cost/goal/escalation/trigger dashboards; ops health dashboard |
| Data modeling, APIs, integration patterns — design them | Multi-tenant Prisma schema, Africa's Talking/Supabase/Redis integrations, Prisma-middleware event bus |
| POCs/MVPs sketch→deployable in days | The 6.0 sub-sprints were each scoped + shipped in days with a hard gate |
| Build on customer data platforms (Snowflake/Databricks/Data 360) | *(Gap — see §11. Bridge: "I've modeled and shipped pipelines on Postgres + Supabase; the patterns transfer; I'd ramp on Snowflake/Databricks fast.")* |
| Customer-facing technical delivery (REQUIRED) | *(The MOE relationship — **we need to talk about what's real here, §11**)* |
| AI-powered dev (Cursor, Claude) | You built LiberiaLearn using exactly this workflow — lead with it |
| Hold your own with sales + customer architects | Governance/permissions/audit design for the MOE; the "translate constraints into architecture" story |

---

## 11. Honest gaps to prepare for (don't get caught flat)

1. **Customer-facing delivery is a hard requirement.** I need to coach this precisely, so answer me honestly (§ at the end): *Did you actually interact with the Ministry / real schools / real users? Or is LiberiaLearn a solo build without a live customer?* Your honest answer changes the entire positioning. If there's ANY real stakeholder contact (a teacher who tested it, an official you demoed to, a pilot school), we build the story around it. If not, we pivot to "I built a product for a real institutional customer profile, with their governance needs as first-class requirements" — and lean on any prior consulting/PS/client work you have elsewhere.
2. **Salesforce / Apex / Agentforce** — you don't have this. Bridge: "I've built the general-purpose version of Agentforce — a tool-calling agent runtime with governance; I'd map those concepts onto Agentforce quickly." Consider skimming Agentforce + Apex basics this week (I can make you a crash sheet).
3. **Snowflake / Databricks / Data 360** — nice-to-have. Bridge via your Postgres/Prisma data-modeling depth.
4. **The deploy** — if asked "is it live," be honest: deployed, pre-pilot, and explain the $22/redeploy prioritization call as *pragmatism*, not incompleteness.

---

## 12. Likely deep-dive questions (drill these)

1. "Walk me through the agent platform. Why did you build the harness before an agent?"
2. "You said the router has no native tool-calling — how exactly does a tool call work end to end?"
3. "A moderation classifier goes down in production. What happens to a student mid-lesson? Why?"
4. "How do you stop an agent from running up an unbounded bill in a customer's environment?"
5. "Tell me about a prompt that failed and what you changed."
6. "You walked into a codebase with two conflicting 'Agent' model families. What did you do?"
7. "How would you extend this to take *actions* in a customer's system (send an email, update a record)?" *(→ your escalation/approval + governed-action thinking.)*
8. "It's not serving real students yet — so what makes it 'production-grade'?"
9. "Design the same thing but for 1M concurrent students on 2G." *(→ system-design round.)*

I'll write out strong model answers to each of these as the next artifact if you want.

---

*Next artifacts on deck (you said you want all four rounds): system-design walkthrough, STAR story bank (mined from your real git history), and a live mock interview. Tell me which is next.*
