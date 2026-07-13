# FARQUEMA SIRYON
667-221-2732 · Baltimore, MD · LinkedIn: farquema-siryon · GitHub: github.com/fasiryon/liberia-learn · liberia-learn.vercel.app

**FORWARD DEPLOYED ENGINEER · APPLIED AI / AGENTIC SYSTEMS · LLM PRODUCTION SYSTEMS**

---

## PROFESSIONAL SUMMARY
Software engineer with 5+ years delivering and supporting mission-critical systems in high-security enterprise environments (FDA, MD Anderson Cancer Center), now building production-grade agentic AI. Sole architect of **LiberiaLearn** — a multi-tenant, offline-first AI learning platform engineered to national-rollout standard, with its **first 5 schools deploying September 2026**. Deep hands-on experience with LLM systems: governed agent runtimes with tool-calling, retrieval-augmented generation, evaluation pipelines, cost governance, and safe deployment. Strong at translating ambiguous, constraint-heavy, real-world problems into shipped, observable systems — and at communicating them to both engineers and non-technical stakeholders.

## FLAGSHIP PROJECT — LIBERIALEARN  *(sole architect & builder · first schools live Sept 2026)*
- Designed and built a **multi-tenant, offline-first** AI learning platform for a low-connectivity national market (Liberia), engineered to national-rollout standard; **first 5 schools going live September 2026**, with the Ministry of Education as the institutional stakeholder.
- Built an **agentic AI platform** — a governed LLM agent runtime with **provider-agnostic tool-calling** (Zod-validated inputs/outputs), input/output moderation, **three-tier cost caps** (per-invocation / per-user-day / per-day), dual kill switches, a **long-running goal state machine** (human-in-the-loop + scheduled resume), and full invocation observability — designed so agent behavior is safe, bounded, and auditable before any user-facing agent ships.
- Built a **hybrid RAG pipeline** (pgvector dense embeddings + BM25 sparse + Reciprocal Rank Fusion + Cohere rerank) with grounding validation and source-cited answers; an **evaluation pipeline** measures recall@5 across retrieval strategies and forms the foundation for fine-tuning cycles.
- Built an **SFT fine-tuning pipeline** (dataset export from ~5,900 human-approved lessons, training-cost estimation, base-vs-fine-tuned eval harness); OpenAI integration path validated end-to-end (auth, upload, SDK wiring) minus the single paid trigger.
- Architected a **multi-provider model router** (OpenAI / Groq / Grok) with tiered fast/smart routing, per-call cost tracking, circuit breakers, and budget guards; reduced AI cost via caching, rate limiting, and tier routing.
- Integrated **AWS** services from a serverless backend: **SQS** (async job queue for embeddings, audio, imports), **S3** (governed data exports), **CloudWatch** (custom metrics); ~22 scheduled cron pipelines for background workloads.
- Designed a **multi-tenant PostgreSQL** schema (Prisma) with strict tenant isolation, an **RBAC permissions matrix** across 6 roles (student / teacher / admin / guardian / MOE), append-only audit logging, and **Google SSO** with an invite gate (SAML-ready architecture).
- Built **offline-first delivery**: a service-worker sync queue with idempotent submissions, offline lesson packs, low-bandwidth mode, and an **SMS channel** (two-way quizzes + guardian digests) for feature-phone users.
- Shipped an **AI curriculum factory** (two-pass generation + quality gates + national-standard alignment) producing ~5,900 human-approved lessons, and an **auto-grading** system (essay via rubric, code via Judge0 sandbox).
- Maintained **~3,800 automated tests** (Vitest), strict TypeScript (0 errors), and full observability (structured logging, ops health dashboard, email/SMS alerting, on-call runbook).
- **Load-tested to 2,000 concurrent users**; documented the scaling bottlenecks and remediation plan as the pre-rollout gate.

## TECHNICAL SKILLS
**AI / LLM Systems:** agentic systems (tool-calling, agent runtimes, goal loops, orchestration), RAG (hybrid retrieval, reranking, grounding validation), prompt engineering, LLM evaluation pipelines, moderation/safety, cost & latency optimization; fine-tuning (SFT dataset export, cost estimation, eval harness, OpenAI SDK wiring validated end-to-end)
**Backend & Systems:** TypeScript, Node.js, Next.js, Python, PostgreSQL, Prisma, REST API design, async / distributed job processing, multi-tenant SaaS
**Cloud & Infrastructure:** AWS (SQS, S3, CloudWatch, IAM), Vercel serverless, Docker, CI/CD; observability, reliability engineering, cost optimization
**Architecture:** multi-tenant SaaS, RBAC, SSO, event-driven, offline-first, system observability

## PROFESSIONAL EXPERIENCE

**Software Engineer — TekSynap (FDA Contract)** · Nov 2023 – May 2026
- Diagnosed and resolved issues across applications, infrastructure, and backend services in a high-security, mission-critical production environment.
- Investigated application-level failures using APIs, system logs, and backend services; performed root-cause analysis across network, OS, and application layers to improve reliability.
- Built automation scripts and tooling to streamline recurring operational tasks; communicated clearly with technical and non-technical stakeholders under uptime pressure.

**Software Engineer — MD Anderson Cancer Center** · Dec 2021 – Sep 2023
- Designed and maintained software integrations across high-availability healthcare systems, ensuring application stability and continuity of care workflows.
- Investigated and resolved production incidents across application, infrastructure, and user environments where uptime is critical.
- Collaborated with engineering and infrastructure teams to improve stability and maintainability; developed tooling/automation to reduce manual overhead.
- Navigated complex healthcare constraints (HIPAA, HL7, data sensitivity) in engineering decisions.

**Technical Support Engineer — Rackspace Technology** · Jun 2019 – Nov 2021
- Troubleshot cloud and distributed systems (networking, performance) across enterprise environments; hands-on with scalable cloud infrastructure and system behavior under load.

**Technical Support Engineer — FTI Consulting** · Feb 2018 – Oct 2021  *(confirm overlap w/ Rackspace — contract/PT?)*
- Delivered technical solutions in fast-paced consulting engagements across diverse client systems; diagnosed ambiguous issues and delivered timely, practical resolutions.

**Desktop Support Engineer — Exelon** · May 2016 – Jan 2018
- Provided enterprise support across corporate systems; built a foundation in troubleshooting, networking, and IT operations for large user environments.

## CERTIFICATIONS
AWS Certified Solutions Architect – Associate · CompTIA Security+ (SY0-701)

## EDUCATION
B.S. Information Systems — Towson University *(In Progress)*

---

### What changed & why (delete this block before sending)
- **1M/5,000-schools claim → "built to national standard, first 5 schools Sept 2026" + load-test honesty.** Survives every follow-up; the real go-live is a stronger FDE signal.
- **Added the agent platform** (was missing) — the most Salesforce-Agentforce-relevant thing you built. It now leads.
- **AWS: dropped "ECS Fargate"** (not in the repo — you're on Vercel); kept SQS/S3/CloudWatch (real). Verify they're wired in prod so you can speak to them.
- **RAG upgraded** to the real hybrid+rerank description (more impressive than "pgvector + OpenAI").
- **Tests: 1,500 → ~3,800** (you were under-selling).
- **Fine-tuning** moved to an honest "familiar / eval foundation" line (upgrade once you build the pipeline).
- **SSO/SAML → "Google SSO, SAML-ready"** (no SAML in repo).
- **Percentages removed from bullets** — reintroduce only ones you can defend with methodology (retrieval recall@5 is defensible; be ready for "measured how, vs what baseline").
- **Titles kept as SWE** (you confirmed official) — bullets kept engineering-forward to match.
- Flagged the **FTI/Rackspace date overlap** — clarify if both were full-time.
