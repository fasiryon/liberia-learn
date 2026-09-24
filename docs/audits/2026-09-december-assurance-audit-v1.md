# December Product Assurance + Red-Team Audit V1

- Base: `bec602d859fed1b101fcbc6f4895da999f70b0b7`
- Date: 2026-09-24
- Machine-readable report: `docs/audits/2026-09-december-assurance-audit-v1.json`
- Method: static repository audit, heuristic sweeps of all 579 API routes and 332 pages, a nav-reachability scan, and token contrast computation. Each fix has focused and hostile Vitest coverage. Supabase and Vercel were unavailable, and nothing was mutated in staging or production.

| Severity | Found | Fixed | Documented |
| --- | --- | --- | --- |
| P0 | 3 | 3 | 0 |
| P1 | 6 | 4 fixed + 1 partial (F11) | 1 (D01, true stop) |
| P2 | 10 | 6 | 4 |
| P3 | 7 | 1 | 6 |

## Fixed

| ID | Sev | Lens | Finding | Closure test |
| --- | --- | --- | --- | --- |
| F01 | P0 | Security / teacher | Discussion per-ID routes had no school or class scope. Staff anywhere could approve held Grade 1-6 posts and delete, lock, or pin threads, a school admin could read another school's threads, and students could act in classes they are not in. | `__tests__/sprint7.discussion.test.ts` (hostile block) |
| F02 | P0 | Security / student | `POST /api/packs/week` trusted `audience` and `classId`. A student could receive answer keys, anyone could pack another school's class, and a missing class produced a platform-wide pack. | `__tests__/packs/packWeek.authz.test.ts` |
| F03 | P0 | Teacher / privacy | `/teacher/student/[id]` showed any child's PII to any teacher nationally because the roster check was commented out. It also showed an invented location. | `__tests__/teacher/teacherStudentProfile.authz.test.ts` |
| F04 | P1 | Privacy | A school admin could mint public certificate share links (with the child's name) for other schools. | `__tests__/certificates/share.test.ts` |
| F05 | P1 | MOE / privacy | National WAEC readiness had no small-cell suppression (cohorts of 1-4). | `__tests__/waec/nationalAggregate.suppression.test.ts` |
| F06 | P1 | Guardian | A child with no evidence was shown to the family as "struggling" (avgScore 0). | `__tests__/intelligence.guardian-route.test.ts` |
| F07 | P2 | Guardian | Progress had no child switching, and it used the guardian's school rather than the child's. | same |
| F08 | P2 | Security | Pack download was an IDOR for teachers and admins (teacher packs contain answer keys). | `__tests__/packs/packDownload.authz.test.ts` |
| F09 | P2 | Student | The legacy homework page allowed cross-school reads, and submit accepted non-enrolled classes. | `__tests__/student/homeworkSubmit.authz.test.ts` |
| F10 | P1 | Recovery | Lesson completion replays duplicated mastery evidence and guardian SMS. | `__tests__/student.lesson-delivery.test.ts` |
| F11 | P1 (partial) | Authority | The placement payload was unbounded and its band came from the client. A teacher's single "confirm" writes it into `Student.currentGrade`. | `__tests__/placement.contract.test.ts` |
| F12 | P2 | Operations | Credential login failures were silent. They now emit reason-coded, PII-free metrics. | `__tests__/auth.loginFailureDiagnostics.test.ts` |
| F13 | P2 | Reachability | 14 dead portal links (6 distinct missing routes), across all five portals. | `__tests__/reachability.portalLinks.test.ts` |
| F14 | P2 | Accessibility | 134 primary accent surfaces had 3.15:1 text contrast and a near-invisible hover state. | `__tests__/a11y.accentContrast.test.ts` |
| F15 | P3 | Accessibility | NotificationBell decremented the unread count twice, used click-only divs, and overflowed at 320px. | TypeScript and build only (the repo has no DOM test library) |

## Documented (require policy or architecture authority)

| ID | Sev | Finding | Why not fixed |
| --- | --- | --- | --- |
| D01 | P1 | Placement answer custody is client-side (`correctAnswer` is sent before answering, and grading trusts client `correct` flags). | **True stop.** It needs a server-held placement session and item-custody design, which is an educational-authority and architecture decision. |
| D02 | P2 | Support has no per-learner offline-sync diagnostic view. | This would be a new product surface. |
| D03 | P3 | The `/moe/live?token=` display link can't work without a session. | Showing national data without a session is a policy decision. |
| D04 | P2 | School admins can read national WAEC aggregates. | Policy decision. |
| D05 | P3 | Scaffold variant bodies are readable by any student (content only). | Low impact. |
| D06 | P3 | The portfolio share link requires login but no relationship to the student. | Sharing audience is a policy decision. |
| D07 | P2 | Agent tools aggregate WAEC readiness without suppression. | The evidence contract of human-reviewed drafts would change. |
| D08 | P3 | A discussion reply's `parentPostId` isn't checked against its thread. | Low impact. |
| D09 | P3 | The student, teacher, and guardian layouts have no role gate. | Architecture decision (defense in depth). |
| D10 | P2 | Any teacher in the school can confirm a placement grade. | Promotion authority is a policy decision. |
| D11 | P3 | There is no MOE audit-log surface (the dead link was removed). | Whether MOE can read audit logs is a policy decision. |

## Core journeys

| Journey | Result |
| --- | --- |
| Student: today → lesson → exit ticket → completion → mastery | PASS (after F10) |
| Student: placement → teacher review → grade | PARTIAL (F11 fixed, D01 open) |
| Teacher: dashboard → student profile → evidence → intervention | PASS (after F03) |
| Guardian: child selection → attendance and assignments → progress → message | PASS (after F06/F07) |
| School admin: school-scoped dashboards and certificate share | PASS (after F04) |
| MOE: national aggregates with small-cell protection | PASS (after F05) |

## Authority statement

No new learner-state writer or parallel educational authority was added:
- `lib/discussion/access.ts` reuses the existing scope rule from the discussion list and create routes.
- `evidenceCount` is read-only metadata.
- Lesson replay protection removes duplicate evidence and adds no new evidence.
