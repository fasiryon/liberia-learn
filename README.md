# LiberiaLearn

LiberiaLearn is a national-scale K-12 learning platform for Liberia's Ministry of Education. It is built as production infrastructure, not a demo application, with role-based experiences for students, teachers, guardians, school administrators, platform operators, and ministry reviewers.

`Tests: 1577 passing` `Test files: 214` `App routes: 189` `Prisma models: 81` `Curriculum: 1306 READY lessons` `Average lesson length: 1450 words`

Live URL: `https://liberia-learn.vercel.app`

## Technical Highlights

- Multi-tenant role system across student, teacher, guardian, school-admin, platform-admin, and MOE experiences from one repository.
- App Router web platform with `189` route handlers and `377` app-layer entry files.
- Prisma-backed domain model with `81` models covering users, schools, curriculum, assessments, governance, messaging, AI usage, and ops telemetry.
- Grounded AI architecture with routed provider access, usage logging, cost guardrails, and curriculum-aware retrieval.
- Offline-first student flows for interrupted connectivity, including queue-based sync and resumable learning state.
- Immutable audit logging, governance exports, and compliance reporting for school and ministry review.
- Operational hardening through SLO tracking, health routes, incident runbooks, worker deployment, and scale-readiness documentation.
- Full curriculum audit gate with `1306/1306` lessons marked `READY` at an average of `1450` words.

## Architecture

The runtime is centered on a Next.js App Router application in [app](C:/Users/fasir/liberia-learn/app), Prisma access in [lib/db.ts](C:/Users/fasir/liberia-learn/lib/db.ts), authentication and tenant enforcement in [lib/auth.ts](C:/Users/fasir/liberia-learn/lib/auth.ts) and [middleware.ts](C:/Users/fasir/liberia-learn/middleware.ts), and background processing in [worker](C:/Users/fasir/liberia-learn/worker).

```mermaid
flowchart LR
  Users[Students | Teachers | Guardians | Admins | MOE] --> Web[Next.js App Router]
  Web --> Auth[Auth and RBAC]
  Web --> API[Route Handlers]
  API --> Prisma[Prisma Data Layer]
  Prisma --> DB[(Postgres)]
  API --> AI[Routed AI Services]
  AI --> Providers[OpenAI and Groq]
  API --> Queue[SQS-backed Background Work]
  Queue --> Worker[ECS Worker]
  API --> Audit[Audit and Metrics]
  Audit --> Ops[Ops Dashboards and Governance Reports]
```

Existing architecture references:

- [SYSTEM_ARCHITECTURE.md](C:/Users/fasir/liberia-learn/docs/SYSTEM_ARCHITECTURE.md)
- [SYSTEM_OVERVIEW.md](C:/Users/fasir/liberia-learn/docs/architecture/SYSTEM_OVERVIEW.md)
- [AI_DECISION_FLOW.md](C:/Users/fasir/liberia-learn/docs/AI_DECISION_FLOW.md)
- [CURRICULUM_PIPELINE.md](C:/Users/fasir/liberia-learn/docs/CURRICULUM_PIPELINE.md)
- [INTELLIGENCE_FLOW.md](C:/Users/fasir/liberia-learn/docs/INTELLIGENCE_FLOW.md)

## Repository Structure

- [app](C:/Users/fasir/liberia-learn/app): UI surfaces, layouts, and API route handlers.
- [components](C:/Users/fasir/liberia-learn/components): shared interface building blocks.
- [lib](C:/Users/fasir/liberia-learn/lib): auth, AI orchestration, data services, telemetry, and domain logic.
- [prisma](C:/Users/fasir/liberia-learn/prisma): schema, migrations, seeds, and data-loading assets.
- [worker](C:/Users/fasir/liberia-learn/worker): background job consumer and handlers.
- [scripts](C:/Users/fasir/liberia-learn/scripts): audits, curriculum pipelines, seed helpers, and maintenance scripts.
- [docs](C:/Users/fasir/liberia-learn/docs): architecture, governance, ops, rollout, and reviewer-facing documentation.
- [__tests__](C:/Users/fasir/liberia-learn/__tests__): Vitest suites for routes, services, flows, and runtime gates.
- [infra](C:/Users/fasir/liberia-learn/infra): deployment and infrastructure artifacts.

## Local Setup

```bash
npm install
npx prisma generate
npx tsc --noEmit
npx vitest run
npm run build
```

Typical local environment files:

- `.env`
- `.env.local`
- `.env.production`

Environment behavior is documented in [ENVIRONMENTS.md](C:/Users/fasir/liberia-learn/docs/ops/ENVIRONMENTS.md).

## Documentation

| Document | Purpose |
|---|---|
| [ARCHITECTURE_EXECUTIVE.md](C:/Users/fasir/liberia-learn/docs/ARCHITECTURE_EXECUTIVE.md) | Technical overview for senior engineers and technical reviewers |
| [API_REFERENCE.md](C:/Users/fasir/liberia-learn/docs/API_REFERENCE.md) | Human-readable API guide grouped by role |
| [MOE_TECHNICAL_BRIEF.md](C:/Users/fasir/liberia-learn/docs/MOE_TECHNICAL_BRIEF.md) | Ministry-facing technical brief in plain language |
| [SYSTEM_ARCHITECTURE.md](C:/Users/fasir/liberia-learn/docs/SYSTEM_ARCHITECTURE.md) | Detailed implementation architecture |
| [SECURITY_MODEL.md](C:/Users/fasir/liberia-learn/docs/governance/SECURITY_MODEL.md) | Security and governance controls |
| [SCALE_READINESS.md](C:/Users/fasir/liberia-learn/docs/ops/SCALE_READINESS.md) | Scale assumptions, bottlenecks, and readiness posture |
| [INCIDENT_RESPONSE.md](C:/Users/fasir/liberia-learn/docs/ops/INCIDENT_RESPONSE.md) | Incident handling and rollback procedures |
| [WORKER_DEPLOYMENT.md](C:/Users/fasir/liberia-learn/docs/ops/WORKER_DEPLOYMENT.md) | Background worker deployment and verification |

## Current Status

Current verified repo state:

- Sprint 8 is complete.
- Sprint 9 documentation is in progress.
- Latest validated gate: `npx tsc --noEmit`, `npx vitest run --reporter=dot`, and `npm run build`.
- Curriculum audit: `1306/1306` lessons are `READY`.

Execution tracking lives in [CURRENT_EXECUTION_STATE.md](C:/Users/fasir/liberia-learn/docs/roadmaps/CURRENT_EXECUTION_STATE.md).
