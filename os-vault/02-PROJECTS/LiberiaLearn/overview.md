# LiberiaLearn — Project Overview

**Type:** Multi-tenant AI education SaaS
**Client:** Ministry of Education, Republic of Liberia
**Version:** 1.0.0 (released 2026-03-01)
**Status:** Post-release sprint hardening — sprint/phase system active

## Completion by System

| System | Status | Notes |
|---|---|---|
| Multi-tenant school management | ✅ Complete | schoolId isolation on every query |
| Authentication + RBAC | ✅ Complete | 6 roles, NextAuth, session invalidation |
| Curriculum generation (AI) | ✅ Complete | 53 MOE standards, 94% coverage |
| Lesson delivery engine | ✅ Complete | Profiles, tracking, compliance reporting |
| Assessment + mastery engine | ✅ Complete | 92 strands, per-student profiles |
| Adaptive recommendations | ✅ Complete | Priority ladder, mastery scoring |
| Teacher alerts + automation | ✅ Complete | Idempotent alert generation |
| Guardian portal + SMS | ✅ Complete | Africa's Talking, Liberian phone validation |
| Live class sessions (Jitsi) | ✅ Complete | Teacher start/end, student join, attendance |
| Governance exports | ✅ Complete | Approval workflow, circuit breaker |
| MOE oversight portal | ✅ Complete | 5 national routes, zero PII |
| Exam system + certification | ✅ Complete | Canva certificates, Higgsfield video |
| Offline-first design | ✅ Complete | Service worker, IndexedDB, sync API |
| Disaster recovery | ✅ Complete | Health check script, rollback runbook |
| Guardian self-registration | ✅ Complete | Sprint 16C |
| Student self-registration | ✅ Complete | Sprint 16C, rate-limited |
| OWASP security hardening | ✅ Complete | Sprint 16B — 5 HIGH fixes |
| AI trust indicators | ✅ Complete | Sprint trust sprint |
| Autonomous OS (signals/predictions) | 🔄 In progress | Current sprint phase |
| Liberia delivery hardening | ✅ Complete | Sprint 15 — low-bandwidth, offline |
| Training center | ✅ Complete | 8 micro-modules, admin adoption view |
| Report cards | ✅ Complete | Draft/publish workflow, guardian view |
| Discussion boards | ✅ Complete | Sprint 7 — class threads, moderation |

## Audit Gates

- **Gate 1:** ✅ Passed — 516 tests (2026-02-26)
- **Gate 2:** ✅ Passed — (see docs/rollout/AUDIT_GATE_2_REPORT.md)
- **Gate 3:** ✅ Certified — (see docs/audits/GATE_3_CERTIFICATION.md)
- **Gate 4 (pilot):** ⏳ Pending — awaiting MOE pilot school selection

## Architecture Notes
See: `docs/architecture/SYSTEM_OVERVIEW.md`, `docs/architecture/TENANCY_ISOLATION.md`
- Multi-tenant: schoolId isolation enforced on every Prisma query
- Feature flags: ~50 flags covering all major features (see .env.example)
- Offline: idb-keyval + service worker + POST /api/student/sync
- AI: Multi-provider (Anthropic/OpenAI/Groq) with monthly budget caps
- Rate limiting: Upstash Redis (@upstash/ratelimit) on AI-heavy and auth routes

## Known Open Items (non-blocking)

- ACTION-2: ENGINEERING subject has no MOE standard codes — structural gap
- ACTION-4: CS G1_3 standard codes missing
- ACTION-5: CS G4_6 hardware strand missing
- 3 ESLint warnings (pre-existing, non-blocking)
- `ENABLE_GOV_EXPORTS` defaults ON — confirm before first production school onboarding

## Technical Debt

- `lib/factory/` and `app/api/governance/` excluded from tsc compile (legacy code in tsconfig.json)
- `_app_backup_*`, `_ARCHIVE_*` folders excluded — investigate what can be deleted
- No CLAUDE.md in repo root (documentation is in os-vault/SYSTEM/CLAUDE.md instead)

## Test Health
**Current:** 371 test files, 2945+ tests passing (sprint 17, 2026-05-15)
**Test command:** `npx vitest run`
**E2E tests:** `npx playwright test --config=playwright-audit.config.ts` (13 tests)

## Deployment
- **Production URL:** [User to populate — Vercel URL]
- **Deploy command:** `git push origin main` → Vercel auto-deploys
- **Build time:** ~2-3 min (prisma generate + next build)
- **Health check:** `GET /api/health` → 4 parallel checks

## Sprint Roadmap — Sprints 18–26

See full detail: `sprints/SPRINT-ROADMAP.md`

| Sprint | Name | Pilot-Ready Gate |
|--------|------|-----------------|
| 18 | Labs + Password Recovery + PDF Reports | — |
| 19 | AI Conversational Tutor | — |
| 20 | Auto-Grading + Grade Book | **Pilot-ready after this sprint** |
| 21 | Video Micro-Lessons | — |
| 22 | Google SSO (NextAuth) | — |
| 23 | Push Notifications + Student Flags | — |
| 24 | Onboarding + Privacy + Data Export | Feature-complete after this sprint |
| 25 | Teacher Content Creation | — |
| 26 | Load Testing + Infrastructure | **National rollout sign-off** |

### Curriculum Generation — Two-Pass System (Sprint 17, 2026-05-15)
- Pass 1 (Groq in prod / OpenAI locally): text mode, 17-section prompt, produces 2500–3500+ words
- Pass 2 (OpenAI JSON mode): extracts title + objectives + questions only; body used verbatim
- Quality gate thresholds: G1-3: 1500w, G4-6: 2000w, G7-9: 2500w, G10+: 3000w
- 319 regen jobs reset to pending for overnight batch (2026-05-15)
- Labs generation: changed to warn (not fail) when labs missing; Sprint 18 adds dedicated labs batch script
