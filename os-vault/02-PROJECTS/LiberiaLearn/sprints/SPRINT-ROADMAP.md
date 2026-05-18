# LiberiaLearn — Sprint Roadmap (Sprints 18–26)

**Goal:** Close all remaining gaps, add competitive features, and validate at national-scale load before full MOE national rollout.

**Pilot-ready:** After Sprint 20 (core learning loop complete + auto-grading)
**National-rollout-ready:** After Sprint 26 (load-tested, teacher content creation, all edge cases handled)

---

## Sprint Summary

| Sprint | Name | Focus | Status |
|--------|------|--------|--------|
| 18 | Labs + Recovery + Reports | Labs Pass 3, password recovery, PDF reports | Planned |
| 19 | AI Conversational Tutor | Per-student AI tutor with safety + offline fallback | Planned |
| 20 | Auto-Grading + Grade Book | Homework auto-grade, stale timeout cron, grade notifs | Planned |
| 21 | Video Micro-Lessons | Vercel Blob upload, moderation queue, storage quota | Planned |
| 22 | Google SSO | NextAuth alongside custom JWT, account linking | Planned |
| 23 | Push Notifications | Web Push API, student flags, guardian milestones | Planned |
| 24 | Onboarding + Housekeeping | Tours, backup cron, privacy policy, data export | Planned |
| 25 | Teacher Content Creation | Rich-text editor, draft/publish, teacher-created lessons | Planned |
| 26 | Load Testing + Hardening | 5K concurrent users, circuit breaker, DB pool, cache warm | Planned |

---

## Readiness Assessment

### After Sprint 20 — Pilot-Ready
- ✅ Complete learning loop: lessons → assessments → auto-grading → teacher review
- ✅ AI tutor for student support
- ✅ Labs generation restored
- ✅ Student password recovery (including no-email students)
- ✅ Printable progress reports for guardians/MOE

### After Sprint 24 — Feature-Complete
- ✅ Video content alongside text lessons
- ✅ Google SSO for teachers/admins
- ✅ Push notifications for guardians and students
- ✅ Onboarding flows for all roles
- ✅ Privacy policy + data export (GDPR-light)
- ✅ Automated backups confirmed

### After Sprint 26 — National-Rollout-Ready
- ✅ Validated at 5,000 concurrent users
- ✅ Teacher content creation (reduces dependency on AI-only curriculum)
- ✅ AI circuit breakers and cost controls at scale
- ✅ DB connection pool sized for national traffic

---

## Sprint Detail Files

- [Sprint 18](./sprint-18.md) — Labs + Password Recovery + PDF Reports
- [Sprint 19](./sprint-19.md) — AI Conversational Tutor
- [Sprint 20](./sprint-20.md) — Homework Auto-Grading + Grade Book
- [Sprint 21](./sprint-21.md) — Video Micro-Lessons
- [Sprint 22](./sprint-22.md) — Google SSO (NextAuth)
- [Sprint 23](./sprint-23.md) — Push Notifications + Student Flags
- [Sprint 24](./sprint-24.md) — Onboarding Tours + Housekeeping
- [Sprint 25](./sprint-25.md) — Teacher Content Creation
- [Sprint 26](./sprint-26.md) — Load Testing + Infrastructure Hardening
