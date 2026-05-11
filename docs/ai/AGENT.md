# AI Engineering Agent Contract

## Mandatory Engineering Rules

- Inspect first: read `AGENTS.md`, roadmap state, relevant docs, schema, and existing services before changing code.
- Resume from `docs/roadmaps/CURRENT_EXECUTION_STATE.md`.
- Do not skip active sprints or phase gates unless explicitly instructed.
- Never weaken RBAC, tenant isolation, audit logging, privacy, approval gates, or feature flags.
- Additive schema changes only unless an explicit migration plan is approved.
- Use existing platform primitives before creating new ones.

## No-Duplicate-System Rules

Future agents must extend:

- Events: `LearningEvent` and `lib/events/logLearningEvent.ts`.
- AI: `lib/ai/router.ts`, `lib/ai/routedCompletion.ts`, `lib/ai/promptRegistry.ts`, `lib/ai/interactionLog.ts`.
- Analytics: `lib/analytics/*` and existing admin/MOE dashboard routes.
- Audit: `lib/audit.ts` and governance access logs.
- RBAC: `lib/auth.ts`, `lib/permissions.ts`, `lib/tenant.ts`, MOE route guards.
- Curriculum: `CurriculumContent`, `CurriculumVersion`, review routes, import/upgrade services.
- Interventions: `Intervention`, `InterventionChain`, `InterventionRecommendation`, existing intervention services.
- Queues: `lib/queue.ts`, worker paths, existing job models.
- Offline: service worker queue and `lib/offline-queue.ts`.

Do not create a second event bus, AI router, prompt registry, queue abstraction, curriculum model, recommendation model, audit table, analytics dashboard, memory table, or workflow executor without proving the existing system cannot be extended.

## Tenant Isolation Rules

- Every autonomous workflow must carry `schoolId` where tenant scoped and must preserve district/national aggregate boundaries.
- Non-platform users must not query across schools.
- MOE and national surfaces must use aggregate, suppression-aware responses and must not expose raw PII.
- Memory, embeddings, cache keys, queue partitions, workflow records, and replay controls must include tenant boundaries.

## Auditability Requirements

Every autonomous proposal or action must log:

- actor or agent id
- initiating event id
- tenant scope
- target resource
- risk level
- evidence references
- model/prompt/version refs when AI was used
- approval state
- action outcome
- rollback state when applicable

Use `LearningEvent` for education-domain traceability, `AIInteraction` for AI telemetry, and `AuditLog` for governance/security action accountability.

## AI Implementation Standards

- All LLM calls go through `routedCompletion()`.
- Prompt text belongs in the prompt registry or approved prompt module.
- AI outputs must include evidence references and confidence.
- AI outputs must never be accepted as ground truth without deterministic validation.
- Do not log raw prompts, raw student work, names, email addresses, phone numbers, or long free-text PII into telemetry.
- AI may recommend, classify, summarize, or draft; execution follows action governance.

## Testing Requirements

For any runtime implementation, add focused coverage for:

- tenant isolation
- role authorization
- append-only event behavior
- idempotency and replay
- approval gating
- audit logging
- queue retry and dead-letter behavior
- AI telemetry redaction
- feature flag and kill switch behavior

Required validation before advancing:

1. `npx prisma generate`
2. `npx tsc --noEmit`
3. `npx vitest run`
4. `npm run build`

## Rollout Rules

- New autonomous systems start disabled behind server-side feature flags.
- Roll out by environment, then pilot tenant, then district, then national aggregate layer.
- Medium/high-risk execution starts approval-only.
- Add dashboards and incident runbooks before enabling broad autonomy.

## Approval Rules

- Low-risk: may become autonomous after audit evidence, rate limits, and rollback exist.
- Medium-risk: approval required by teacher, admin, or MOE official depending on domain.
- High-risk: platform admin or MOE approval required; no background execution.
- Critical-risk: prohibited unless explicitly authorized by governance policy.

## Reporting Contract

Each agent run must report:

- sprint or phase
- status
- files changed
- architecture findings
- reusable systems
- risks
- validation results
- next step

## Final Gates

Do not mark work complete until validations pass. Stop on code failure, diagnose root cause, and fix only the minimum necessary scope.
