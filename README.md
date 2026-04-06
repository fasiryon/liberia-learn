# LiberiaLearn — Production AI Education Platform

🚀 AI-powered platform designed for national-scale deployment (1M+ students, 5,000+ schools)

---

## What This Is

LiberiaLearn is a full-stack, production-grade AI system — not a demo — built to deliver real-world education infrastructure.

It combines:

- RAG-based AI tutoring (grounded responses, not hallucinations)
- Multi-tenant SaaS architecture (students, teachers, admins, MOE)
- Offline-first learning system for low-connectivity environments
- AWS-backed distributed infrastructure
- AI-driven workflows for tutoring, grading, and curriculum generation

---

## Live System

👉 https://liberia-learn.vercel.app

---

## Source Code

👉 https://github.com/fasiryon/liberia-learn

---

## Key Metrics

- Tests: 1,577 passing  
- Test files: 214  
- API routes: 189  
- Prisma models: 81  
- Curriculum: 1,306 READY lessons  
- Avg lesson length: 1,450 words  

---

## Traction

- 9,000+ repository interactions in recent weeks  
- Increasing developer and system-level interest  

---

## Technical Highlights

- Multi-tenant role system (Student, Teacher, Guardian, Admin, MOE)
- Full App Router platform with 189 route handlers
- Prisma domain model with 81 models (users, curriculum, AI usage, governance)
- RAG-based AI architecture with retrieval + grounding + cost controls
- Offline-first system with IndexedDB sync + resumable sessions
- Immutable audit logging and governance reporting
- SLO tracking, health monitoring, and incident-ready architecture
- Full curriculum system with 1306/1306 lessons READY

---

## Architecture

<img width="1536" height="840" alt="image" src="https://github.com/user-attachments/assets/2ed9c750-b881-4f24-ba1f-760fe1a897e2" />


---

## Repository Structure

- `app` → UI + API route handlers  
- `components` → reusable UI components  
- `lib` → auth, AI orchestration, services, telemetry  
- `prisma` → schema, migrations, seeds  
- `worker` → background job processing  
- `scripts` → audits, pipelines, maintenance  
- `docs` → architecture, governance, operations  
- `tests` → Vitest suites  
- `infra` → deployment and infrastructure  

---

## Local Setup

```bash
npm install
npx prisma generate
npx tsc --noEmit
npx vitest run
npm run build

___
## Environment 
Typical files:
	•	.env
	•	.env.local
	•	.env.production

See ENVIRONMENTS.md for full details.

___
## Documentation
Document
Purpose
ARCHITECTURE_EXECUTIVE.md
Technical overview
API_REFERENCE.md
API documentation
MOE_TECHNICAL_BRIEF.md
Ministry-facing explanation
SYSTEM_ARCHITECTURE.md
Deep system design
SECURITY_MODEL.md
Security controls
SCALE_READINESS.md
Scalability analysis
INCIDENT_RESPONSE.md
Incident handling
WORKER_DEPLOYMENT.md
Background worker setup

___
## Current Status
	•	Sprint 8 complete
	•	Sprint 9 documentation in progress
	•	Build validated via:
	•	npx tsc --noEmit
	•	npx vitest run
	•	npm run build
	•	Curriculum: 1306/1306 lessons READY

Execution tracking lives in [CURRENT_EXECUTION_STATE.md](C:/Users/fasir/liberia-learn/docs/roadmaps/CURRENT_EXECUTION_STATE.md).
