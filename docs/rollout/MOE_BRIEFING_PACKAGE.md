# LiberiaLearn — MOE Briefing Package

**Prepared for:** Ministry of Education, Republic of Liberia
**Date:** 2026-03-01
**Version:** 1.0.0
**Classification:** Official — Ministry Use

---

## Executive Summary

LiberiaLearn is Liberia's national digital learning platform, built to support the Ministry of Education's mandate to improve educational outcomes across all 15 counties. The platform serves teachers, students, school administrators, and district administrators with curriculum tools, lesson delivery tracking, and student progress monitoring — all aligned to MOE national standards.

This briefing covers:
1. What the platform does
2. What data it collects and how it is protected
3. How MOE officials access national oversight data
4. Standard alignment and coverage
5. Deployment readiness

---

## 1. Platform Overview

### Who Uses LiberiaLearn

| Role | Description |
|------|-------------|
| **Teacher** | Creates lessons, tracks delivery, grades assignments, uses AI grading assist |
| **Student** | Views assignments, accesses AI tutor, tracks mastery progress |
| **School Admin** | Manages enrollment, views school performance dashboards |
| **District Admin** | Views district-level aggregates, intervention alerts |
| **MOE Official** | Read-only national oversight: coverage, compliance, impact |
| **Platform Admin** | System-level administration (Ministry ICT team) |

### Core Capabilities

- **Curriculum generation**: AI-assisted lesson plans aligned to MOE standards, with Liberian cultural context (market activities, local geography, community examples)
- **Lesson delivery tracking**: Teachers mark lessons as delivered; compliance rates are tracked per school and district
- **Student assessment**: Assignment creation, submission, AI-assisted grading feedback (advisory; teacher always has final authority)
- **Mastery tracking**: Per-student mastery profiles across MOE strand taxonomy
- **Intervention system**: Class-level alerts for at-risk cohorts; district-level intervention recommendations
- **Virtual labs**: Digital science and math labs for schools with limited physical resources

---

## 2. Data Governance and Privacy

### Data Collected

| Category | What | Purpose |
|----------|------|---------|
| Student records | School enrollment, grade, class assignments | Curriculum matching, progress tracking |
| Assessment data | Assignment scores, submission content | Mastery scoring, teacher grading |
| Delivery data | Lesson delivery timestamps, formats | Compliance reporting |
| Intervention logs | Cohort-level flags, outcome deltas | National intervention impact |
| Audit logs | Actor, action, resource, timestamp | Accountability and compliance |

### Privacy Principles

1. **No PII in AI prompts.** Student names, IDs, and school identifiers are never sent to AI providers. Only anonymised academic content is processed.
2. **Aggregated reporting.** All MOE-level views present district and national aggregates — no individual student records are accessible to MOE officials.
3. **Teacher authority.** AI grading feedback is labelled advisory. `teacherFinalAuthority: true` is always returned. Teachers assign all final grades.
4. **Audit trail.** Every access to sensitive data routes is logged with actor, action, and timestamp. Logs are retained and searchable.
5. **Data residency.** Platform database is hosted on Supabase (AWS US-East-1). Data transfer to AI providers uses encrypted TLS connections.

### PII Export Controls

- PII field export requires explicit opt-in via `ENABLE_GOV_STUDENT_PII_EXPORT=true` **and** platform-admin role
- Default: PII export is **disabled**
- Emergency circuit breaker (`ENABLE_GOV_CIRCUIT_BREAKER=true`) disables all governance exports instantly

---

## 3. MOE National Oversight Portal

MOE officials with the `MOE_OFFICIAL` role access five read-only national oversight endpoints via the MOE portal (`ENABLE_MOE_PORTAL=true`).

### Available Reports

#### National Dashboard — `GET /api/moe/dashboard`

Provides a snapshot of national platform activity:

```json
{
  "schoolCount": 850,
  "districtCount": 15,
  "studentCount": 124000,
  "deliveryRate": 0.847,
  "interventionsLast30Days": 1240
}
```

- `deliveryRate` = lessons marked delivered / total scheduled lessons
- `interventionsLast30Days` = intervention logs created in the past 30 days

#### Standards Coverage — `GET /api/moe/standards-coverage`

Shows how many MOE standard codes have published curriculum content, broken down by subject and grade band:

```json
{
  "coverageSummary": [
    { "subject": "MATH", "band": "G4_6", "total": 8, "covered": 8, "coverageRate": 1.0 },
    { "subject": "SCIENCE", "band": "G7_9", "total": 4, "covered": 3, "coverageRate": 0.75 }
  ],
  "overallCoverageRate": 0.943
}
```

#### Delivery Compliance — `GET /api/moe/delivery-compliance`

Lesson delivery compliance by district:

```json
{
  "districts": [
    {
      "districtId": "dist-montserrado",
      "districtName": "Montserrado",
      "scheduledTotal": 12400,
      "deliveredTotal": 10540,
      "complianceRate": 0.85
    }
  ],
  "nationalComplianceRate": 0.847
}
```

#### Curriculum Health — `GET /api/moe/curriculum-health`

Alignment health (content with ≥1 MOE standard code attached) by subject:

```json
{
  "subjects": [
    { "subject": "MATH", "total": 340, "aligned": 330, "alignmentRate": 0.971 },
    { "subject": "SCIENCE", "total": 180, "aligned": 162, "alignmentRate": 0.9 }
  ]
}
```

#### Intervention Impact — `GET /api/moe/intervention-impact`

Average outcome delta (improvement score) and effect size by district:

```json
{
  "districts": [
    {
      "districtId": "dist-nimba",
      "districtName": "Nimba",
      "interventionCount": 48,
      "avgOutcomeDelta": 0.23,
      "avgEffectSize": 0.41
    }
  ]
}
```

### Access Requirements

- User account with `MOE_OFFICIAL` role (assigned by platform admins)
- `ENABLE_MOE_PORTAL=true` must be set in the deployment environment
- All accesses are audit-logged with the official's user ID and timestamp
- Optional allowlist: `MOE_PORTAL_ALLOWLIST` can restrict access to specific email addresses or domains (e.g. `@moe.gov.lr`)

---

## 4. MOE Standard Alignment

The platform uses **53 MOE standard codes** as its curriculum taxonomy:

| Subject | Standard Codes | Coverage Status |
|---------|---------------|-----------------|
| Mathematics | 20 codes (MATH-G*-*) | 20/20 — full coverage |
| Science | 11 codes (SCI-G*-*) | 10/11 — 1 gap (G4_6 pending) |
| Literacy | 11 codes (LIT-G*-*) | 11/11 — full coverage |
| Civics | 6 codes (CIV-G*-*) | 6/6 — full coverage |
| Computer Science | 5 codes (CS-G*-*) | 3/5 — 2 gaps (G1_3, G4_6) |
| **Total** | **53 codes** | **50/53 — 94%** |

### Strand Catalog

92 curriculum strands across 6 subjects map to the 53 standard codes. Each strand is grade-banded (G1_3, G4_6, G7_9, G10_12) with relevant standard codes attached.

### Known Gaps (Planned for v1.1)

1. **ENGINEERING subject**: 16 strands defined; MOE codes pending assignment (ACTION-2)
2. **CS G1–3**: Foundational computing strand (ACTION-4)
3. **CS G4–6 hardware**: Hardware concepts strand (ACTION-5)

---

## 5. Deployment Readiness

### Technical Readiness

| Gate | Status |
|------|--------|
| All 921 automated tests pass | ✅ |
| TypeScript: zero production errors | ✅ |
| Prisma schema valid | ✅ |
| Database migrations ready | ✅ (apply at deploy time) |
| ESLint: zero errors | ✅ |
| Security review: PII isolation, audit trail | ✅ |

### Recommended Phased Rollout

**Phase 1 — Pilot (Month 1)**
- Deploy to 5–10 pilot schools in Montserrado County
- Enable: `ENABLE_MOE_PORTAL`, `ENABLE_IMPACT_ANALYTICS`, `ENABLE_GOV_EXPORTS`
- MOE oversight team monitors delivery compliance and standards coverage

**Phase 2 — District Expansion (Months 2–3)**
- Expand to all Montserrado schools + 2 additional counties
- Enable: `ENABLE_AI_GRADING_ASSIST`, `ENABLE_VIRTUAL_LABS`, `ENABLE_CLASSROOM_TOOLKIT`
- AI budget monitoring via `AI_BUDGET_MONTHLY_CAP_USD`

**Phase 3 — National Rollout (Months 4–6)**
- All 15 counties
- Enable: `ENABLE_DISTRICT_INTELLIGENCE`, `ENABLE_GEO_INTELLIGENCE`, `ENABLE_NATIONAL_INSIGHTS`
- Full intervention system: `ENABLE_INTERVENTION_ALERTS`, `ENABLE_AI_INTERVENTIONS`

**Phase 4 — Predictive Analytics (Month 6+)**
- `ENABLE_DROPOUT_RISK` — requires 6 months of baseline data
- `ENABLE_CURRICULUM_OPTIMIZATION` — national strand analysis

### Support and Incident Response

- Health check: `npx ts-node scripts/dr/healthCheck.ts`
- Emergency governance shutdown: Set `ENABLE_GOV_CIRCUIT_BREAKER=true` (no deploy required)
- Emergency MOE portal shutdown: Set `ENABLE_MOE_PORTAL=false` (no deploy required)
- Rollback runbook: `docs/rollout/ROLLBACK_RUNBOOK.md`

---

## 6. Contact

**Ministry of Education — ICT Directorate**
For platform administration, role assignment, and technical support.

**LiberiaLearn Engineering Team**
For deployment configuration, incident response, and feature roadmap.

---

*This document is prepared for Ministry of Education internal use. It should not be distributed outside authorised MOE channels.*

---

## 7. Final Readiness Confirmation

**Date:** 2026-03-02
**Status:** Production-Ready — LiberiaLearn v1.0.0

All engineering gates are closed. LiberiaLearn is cleared for national deployment.

### Automated Test Coverage

| Test Suite | Tests | Result |
|------------|-------|--------|
| Full platform suite (86 test files) | 975 | ✅ All pass |
| RR-7 Offline acceptance harness | 8 | ✅ All pass |

### Operations Hardening (RR-6)

| Capability | Status |
|-----------|--------|
| Structured JSON request logging (hashed userId, no PII) | ✅ |
| Public health check endpoint (`GET /api/health`) | ✅ |
| Standardised API error handler (no stack traces in responses) | ✅ |
| Deployment guide (`docs/rollout/DEPLOYMENT_GUIDE.md`) | ✅ |
| Rate limiting on all invite and authentication routes | ✅ |

### Offline Capability (RR-7)

| Capability | Status |
|-----------|--------|
| Service worker (cache-first static assets, queue failed API writes) | ✅ |
| Offline content cache (7-day TTL, 25 MB, LRU eviction, partition-isolated) | ✅ |
| Offline sync queue (exponential backoff, conflict detection, dead-letter) | ✅ |
| Session partition isolation (no cross-user data leakage) | ✅ |
| Server-side sync endpoint (studentProgress, attendance, submission) | ✅ |
| Conflict resolution policies (last-write-wins / graded submissions) | ✅ |
| Acceptance harness: all 8 offline scenarios pass | ✅ |

### Known Outstanding Items (Planned v1.1)

These items are documented, have service-worker-level fallback coverage, and do **not** block
national rollout:

| Item | Description |
|------|-------------|
| ACTION-OFFLINE-1 | Full domain-queue wiring for `lesson.completed`, `lab.session.update`, `lesson.delivered` |
| ACTION-2 | MOE standard codes for ENGINEERING subject (16 strands) |
| ACTION-4 | CS G1–3 foundational computing strand |
| ACTION-5 | CS G4–6 hardware concepts strand |

### Deployment Checklist

- [ ] Apply database migrations: `npx prisma migrate deploy`
- [ ] Seed initial data: `npx prisma db seed`
- [ ] Set `ENABLE_MOE_PORTAL=true` and Phase 1 feature flags
- [ ] Verify health: `GET /api/health` → `{ "status": "healthy" }`
- [ ] Assign `MOE_OFFICIAL` role to designated Ministry oversight personnel
- [ ] Configure `MOE_PORTAL_ALLOWLIST` to restrict access to `@moe.gov.lr` domain

Full deployment instructions: `docs/rollout/DEPLOYMENT_GUIDE.md`
Rollback procedures: `docs/rollout/ROLLBACK_RUNBOOK.md`

---

**Signed off by:** LiberiaLearn Engineering Team, 2026-03-02
