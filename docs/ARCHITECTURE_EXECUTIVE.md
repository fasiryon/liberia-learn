# LiberiaLearn Executive Architecture

## 1. System Purpose

LiberiaLearn is the unified software platform for classroom delivery, student learning, guardian visibility, school administration, platform operations, and Ministry of Education oversight. The goal is to serve as national education infrastructure that can support large-scale deployment without splitting the system into separate products for each stakeholder.

## 2. Current Codebase Snapshot

Verified repository numbers as of `2026-04-03`:

- Package version: `1.0.0`
- Test suite: `1577` passing tests across `214` test files
- App route handlers: `189`
- App-layer entry files (`page.tsx`, `layout.tsx`, `route.ts`, loading/error surfaces): `377`
- Prisma models: `81`
- Curriculum audit: `1306/1306` lessons marked `READY`
- Average lesson length: `1450` words
- Live deployment target in plan metadata: `https://liberia-learn.vercel.app`

## 3. User and Governance Layers

The platform supports six primary governed role groups:

1. Students
2. Teachers
3. Guardians
4. School administrators
5. Platform administrators
6. MOE and district oversight users

These roles are enforced through shared auth and middleware controls in [auth.ts](C:/Users/fasir/liberia-learn/lib/auth.ts), [middleware.ts](C:/Users/fasir/liberia-learn/middleware.ts), and role-aware route guards across [app/api](C:/Users/fasir/liberia-learn/app/api).

## 4. Runtime Topology

Core runtime components:

- Next.js App Router frontend and API layer in [app](C:/Users/fasir/liberia-learn/app)
- Prisma data access in [db.ts](C:/Users/fasir/liberia-learn/lib/db.ts)
- Background processing in [worker](C:/Users/fasir/liberia-learn/worker)
- AI orchestration in [lib/ai](C:/Users/fasir/liberia-learn/lib/ai)
- Telemetry and audit systems in [lib/metrics](C:/Users/fasir/liberia-learn/lib/metrics) and [audit.ts](C:/Users/fasir/liberia-learn/lib/audit.ts)

Reference diagrams already in the repository:

- [system-architecture.mmd](C:/Users/fasir/liberia-learn/docs/architecture/system-architecture.mmd)
- [ai-decision-flow.mmd](C:/Users/fasir/liberia-learn/docs/architecture/ai-decision-flow.mmd)
- [curriculum-pipeline.mmd](C:/Users/fasir/liberia-learn/docs/architecture/curriculum-pipeline.mmd)
- [intelligence-flow.mmd](C:/Users/fasir/liberia-learn/docs/architecture/intelligence-flow.mmd)
- [multi-tenant-isolation.mmd](C:/Users/fasir/liberia-learn/docs/architecture/multi-tenant-isolation.mmd)

## 5. Data Architecture

The schema in [schema.prisma](C:/Users/fasir/liberia-learn/prisma/schema.prisma) currently defines `81` models. The data model includes:

- identity and tenancy: `User`, `School`, `District`, `Class`, `Student`
- learning delivery: `Lesson`, `ScheduledWork`, `StudentProgress`, `PlacementTest`
- assessment and grading: `Exam`, `ExamAttempt`, `Assignment`, `AssignmentSubmission`, `HomeworkSubmission`, `Grade`
- AI and retrieval: `CurriculumContent`, `RagChunk`, `AiInteractionLog`
- governance and operations: `AuditLog`, `MetricEvent`, `SloEvent`, `ExportRecord`

This is a single shared schema with role separation and tenant controls applied in the application layer.

## 6. Curriculum and Learning Systems

Curriculum delivery is not a thin content browser. The system includes:

- curriculum generation and review routes
- standards-alignment reporting
- placement workflows
- adaptive gap detection and practice
- lesson delivery with exit-ticket completion
- exam generation and certification flows

The current curriculum audit confirms:

- `1306` total lessons audited
- `1306` marked `READY`
- `0` lessons below the quality bar in the audit output
- `1450` average words per lesson

Supporting references:

- [CURRICULUM_PIPELINE.md](C:/Users/fasir/liberia-learn/docs/CURRICULUM_PIPELINE.md)
- [curriculum-pipeline.mmd](C:/Users/fasir/liberia-learn/docs/architecture/curriculum-pipeline.mmd)

## 7. AI Architecture and Safety Model

AI is integrated as a routed and governed service layer rather than direct model calls from route handlers. The codebase uses:

- routed completion services in [routedCompletion.ts](C:/Users/fasir/liberia-learn/lib/ai/routedCompletion.ts)
- provider routing and policy in [router.ts](C:/Users/fasir/liberia-learn/lib/ai/router.ts)
- cost logging in [interactionLog.ts](C:/Users/fasir/liberia-learn/lib/ai/interactionLog.ts)
- budget controls in [budgetGuard.ts](C:/Users/fasir/liberia-learn/lib/ai/budgetGuard.ts)
- trust and grounding controls in [trust.ts](C:/Users/fasir/liberia-learn/lib/ai/trust.ts)

Operationally, the AI layer now includes:

- centralized cost tracking
- daily and monthly guardrails
- role-aware retrieval shaping
- audit-friendly usage logs
- no direct raw provider calls from application routes by policy

## 8. Security, Tenancy, and Compliance

Security posture is based on:

- authenticated route access
- RBAC and tenant scoping
- immutable audit protections
- governance exports
- platform-admin and MOE-only surfaces for high-sensitivity operations

Relevant governance documents:

- [SECURITY_MODEL.md](C:/Users/fasir/liberia-learn/docs/governance/SECURITY_MODEL.md)
- [PERMISSIONS_MATRIX.md](C:/Users/fasir/liberia-learn/docs/governance/PERMISSIONS_MATRIX.md)
- [DATA_GOVERNANCE.md](C:/Users/fasir/liberia-learn/docs/governance/DATA_GOVERNANCE.md)
- [COMPLIANCE_AUDITABILITY.md](C:/Users/fasir/liberia-learn/docs/governance/COMPLIANCE_AUDITABILITY.md)

## 9. Reliability and Operations

Operational maturity in the repository now includes:

- CI hardening and runtime gates
- ECS worker deployment artifacts
- scale-readiness documentation
- incident response and rollback procedures
- environment separation controls
- SLO event tracking and ops dashboards

Primary operations references:

- [DEPLOYMENT_RUNBOOK.md](C:/Users/fasir/liberia-learn/docs/ops/DEPLOYMENT_RUNBOOK.md)
- [WORKER_DEPLOYMENT.md](C:/Users/fasir/liberia-learn/docs/ops/WORKER_DEPLOYMENT.md)
- [SCALE_READINESS.md](C:/Users/fasir/liberia-learn/docs/ops/SCALE_READINESS.md)
- [INCIDENT_RESPONSE.md](C:/Users/fasir/liberia-learn/docs/ops/INCIDENT_RESPONSE.md)
- [DATABASE_SCALING.md](C:/Users/fasir/liberia-learn/docs/ops/DATABASE_SCALING.md)

## 10. National Deployment Readiness

Based on the completed sprint sequence through Sprint 8, the repository now contains:

- curriculum at audited readiness
- product metrics and MOE outcomes surfaces
- governance and compliance reporting
- deployment and rollback documentation
- mobile UX hardening for student, teacher, and guardian flows

The current posture is closer to a pilot-ready national platform than a prototype, with the largest remaining gap now being reviewer-facing narrative and API documentation rather than missing core systems.

## 11. Immediate Next Step

The next execution step is Sprint 9 completion:

- finalize this executive narrative
- publish a clean API reference for technical reviewers
- publish a plain-language MOE technical brief
- finish the README rewrite as the public-facing technical overview

Execution tracking remains in [CURRENT_EXECUTION_STATE.md](C:/Users/fasir/liberia-learn/docs/roadmaps/CURRENT_EXECUTION_STATE.md).
