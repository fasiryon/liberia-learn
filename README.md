# LiberiaLearn 🇱🇷
### National K-12 Education Platform — Republic of Liberia

**Live Platform → [liberia-learn.vercel.app](https://liberia-learn.vercel.app/)**

Built by **Farquema A. Siryon**, commissioned for the Ministry of Education, Republic of Liberia.

---

LiberiaLearn is a fully operational national education infrastructure platform serving K-12 schools across Liberia. It is not a demo or prototype — it is production-grade national infrastructure designed to serve 5,000+ schools across three administrative tiers: school level, district level, and the Ministry of Education at the national level.

The platform combines a complete school management system with an AI curriculum factory that generates standards-aligned lessons, assessments, and tutoring support at scale — addressing Liberia's critical shortage of qualified teachers and curriculum materials.

---

## What It Does

**For Students**
- Personalized dashboard with AI tutor grounded in actual lesson content (RAG)
- Placement testing and mastery tracking across subjects
- Lesson delivery, homework submission, and progress over time
- Login via Student ID + PIN — no email required (rural-accessible)

**For Teachers**
- Full class and lesson management
- AI-assisted lesson co-creation: select an objective, generate a lesson, edit it, publish it
- Delivery tracking, attendance, and student mastery visibility
- Messaging with guardians
- Delivery reports with CSV export

**For School Admins**
- Student and teacher enrollment with credential delivery (SMS or printable cards)
- School-wide dashboard: enrollment, attendance, lesson delivery, at-risk students
- Bulk operations and class management
- Audit trail for all school activity

**For Guardians**
- SMS-based registration — no email, no app required
- Phone number + PIN login
- Child's mastery profile, attendance, and active interventions
- Direct messaging with teachers

**For MOE Officials**
- National dashboard: enrollment, lesson delivery, mastery by district
- District drill-down with school-level breakdowns
- Compliance export (CSV)
- National intervention alerts

**For Platform Admins**
- Multi-school management
- Credential delivery at scale
- Full audit log access
- AI factory controls

---

## The AI Factory

The core technical differentiator is an AI curriculum production engine that generates complete, MOE-standards-aligned curriculum materials automatically.

```
Platform Admin triggers generation
          ↓
Education Work Order (EWO) created
          ↓
Stage 1 — Curriculum Architecture
  (strand → learning objectives → sequence)
          ↓
Stage 2 — Lesson Generation
  (title, content, delivery notes, duration,
   Liberian cultural context injected)
          ↓
Stage 3 — Assessment Generation
  (questions, rubric, answer key)
          ↓
Stage 4 — Tutor Metadata
  (hints, common mistakes, scaffolding prompts)
          ↓
Stage 5 — Governance Validation
  (MOE standards alignment check)
          ↓
Artifact promoted to Gold status
  (served to teachers and students)
```

**Unit Assembly Layer** — Groups lessons into structured units with intro, core, practice, review, and assessment lessons. Each unit follows a narrative arc aligned to MOE standards.

**Textbook Compiler** — Compiles all units for a subject and grade into a downloadable PDF textbook. A Grade 5 Mathematics textbook with chapters, lesson content, and answer keys can be generated in seconds from stored curriculum artifacts. This directly addresses Liberia's physical textbook shortage.

**RAG Tutor** — The student AI tutor retrieves actual lesson artifacts from the database using pgvector similarity search before generating answers. Students receive responses grounded in what their teacher taught — not generic internet knowledge.

**Teacher Co-Creation** — Teachers can select a learning objective, trigger AI generation, edit the output, and publish it as official classroom material. This turns the platform into a collaborative curriculum development tool.

---

## Current Curriculum Coverage

| Subject | Grades | Lessons | Status |
|---------|--------|---------|--------|
| Mathematics | 5–8 | 34 | APPROVED |
| Literacy | 5–9 | 28 | APPROVED |
| Science | 5–8 | 23 | APPROVED |
| Civics | 6–8 | 15 | APPROVED |
| English | 5 | 3 | Published |

103 lessons embedded in pgvector for RAG retrieval.

---

## Technical Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TailwindCSS |
| Backend | Next.js API Routes, TypeScript |
| Database | Supabase (PostgreSQL + pgvector) |
| ORM | Prisma |
| Auth | NextAuth.js |
| AI — Smart tier | OpenAI GPT-4o-mini |
| AI — Fast tier | Groq (Llama 3.1 8B) — auto-routed |
| Embeddings | OpenAI text-embedding-3-small (1536-dim) |
| Vector search | pgvector (ivfflat cosine similarity) |
| PDF generation | @react-pdf/renderer |
| Deployment | Vercel |
| Testing | Vitest (1,205 tests, 100% passing) |

**Tiered AI Router** — All LLM calls are automatically routed between Groq (fast, low-cost) and OpenAI (smart) based on query complexity. Simple factual questions go to Groq at $0.05/M tokens. Complex generation goes to GPT-4o-mini. Cost is tracked per request.

---

## Deployment Constraints

This platform was designed for the real conditions of Liberian schools:

- **SMS-primary** — Most users have no institutional email. Guardians register via SMS link. Students receive credentials on printed cards.
- **Mobile-first** — Large touch targets, simple language, works on basic Android browsers.
- **Offline capability** — Lesson delivery and lab sessions queue offline and sync when connectivity returns.
- **Printed credentials** — School admins generate printable credential cards for students and teachers with name, ID, PIN, and login instructions.
- **Low digital literacy** — All guardian and student flows use simple language and minimal steps.

---

## Certification History

| Gate | Description | Verdict | Date |
|------|-------------|---------|------|
| Gate 1 | Foundation (8/8 domains) | GO ✅ | 2026-02-26 |
| Gate 2 | Core platform (8/8 domains, 848 tests) | GO ✅ | 2026-03-01 |
| Gate 3 | Pre-launch (9/9 domains, 1,174 tests) | GO ✅ | 2026-03-02 |
| Gate 4 | Advanced features (10/10 domains, 1,205 tests) | GO ✅ | 2026-03-13 |

Certification documents: [`docs/audits/`](docs/audits/)

---

## Six User Roles

| Role | Access | Login |
|------|--------|-------|
| Platform Admin | All schools, all data, AI factory | Email + password |
| School Admin | Own school only | Email + password |
| Teacher | Own classes only | Email + password |
| Student | Own dashboard only | Student ID + PIN |
| Guardian | Linked children only | Phone + PIN |
| MOE Official | National dashboard, all districts | Email + password (MOE portal) |

---

## Demo Accounts

Run `npm run seed:demo` to seed 10 schools, 3 districts, and 325 students with realistic Liberian names.

School, teacher, student, and guardian demo accounts use password: **`DemoSeed2026!`**  
MOE official accounts use password: **`MOESeed2026!`**

| Role | Email | Password |
|------|-------|----------|
| School Admin  Capitol Hill Academy | `admin@cha.edu.lr` | `DemoSeed2026!` |
| Teacher | `teacher1@cha.edu.lr` | `DemoSeed2026!` |
| Student  also supports PIN login | `student1@cha.edu.lr` | `DemoSeed2026!` |
| Guardian | `guardian1@cha.family.lr` | `DemoSeed2026!` |
| MOE Official | `official1@moe.gov.lr` | `MOESeed2026!` |
| MOE Official | `official2@moe.gov.lr` | `MOESeed2026!` |

MOE portal: [`/moe/login`](https://liberialearn.vercel.app/moe/login)

---

## Local Development

```bash
git clone https://github.com/fasiryon/liberia-learn.git
cd liberia-learn
npm install
cp .env.example .env.local
# Fill in: DATABASE_URL, NEXTAUTH_SECRET, OPENAI_API_KEY
npx prisma generate
npx prisma migrate deploy
npm run seed:demo
npm run dev
```

Visit `http://localhost:3000`

**Embed curriculum for RAG tutor:**
```bash
npm run embed:curriculum
```

**Run tests:**
```bash
npm test
```

---

## Feature Flags

All major features are flag-gated for safe rollout:

```env
ENABLE_GUARDIAN_PORTAL=true
ENABLE_GUARDIAN_DASHBOARD=true
ENABLE_MOE_PORTAL=true
ENABLE_MOE_LOGIN_PORTAL=true
ENABLE_RAG_TUTOR=true
ENABLE_TEACHER_GENERATION=true
ENABLE_UNIT_ASSEMBLY=true
ENABLE_TEXTBOOK_COMPILER=true
NEXT_PUBLIC_ENABLE_AI_TUTOR=true
```

---

## Roadmap

- [ ] First real school pilot (1 school, end-to-end validation)
- [ ] Redis rate limiting (Upstash) before public registration
- [ ] National rollout — 5,000+ schools
- [ ] Adaptive practice engine (mastery-driven exercise generation)
- [ ] Regional expansion (Sierra Leone, Guinea)

---

## About

**Farquema A. Siryon** — Founder and Builder

LiberiaLearn was designed and built as national education infrastructure for the Republic of Liberia. The platform addresses three critical gaps: shortage of qualified teachers, absence of curriculum materials in rural schools, and lack of government visibility into learning outcomes at scale.

---

*Built with Next.js · Supabase · OpenAI · Groq · Vercel*
*Ministry of Education, Republic of Liberia · 2026*

## Running With Docker

```bash
docker build -t liberialearn-web .
docker-compose up --build
```

`docker-compose.yml` starts the Next.js web container and the SQS worker container together, both using `.env.local` for local secrets.
