# LiberiaLearn API Reference

This document is a reviewer-facing API map for the main role groups in LiberiaLearn. It is not an OpenAPI export. It is a human-readable guide to the routes that matter most for technical review.

Current route-handler count in [app/api](C:/Users/fasir/liberia-learn/app/api): `189`

Role-group route counts:

- School admin: `60`
- Teacher: `38`
- Student: `23`
- Guardian: `11`
- MOE and district oversight: `11`
- Platform admin: `9`
- Auth routes: `4`

## Student

| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| `GET` | `/api/student/today` | `STUDENT` | Session only | Daily work summary for the student |
| `GET` | `/api/student/work/[scheduledWorkId]` | `STUDENT` | Path param `scheduledWorkId` | Scheduled learning item with lesson or assignment payload |
| `POST` | `/api/student/work/[scheduledWorkId]/complete` | `STUDENT` | Completion payload for scheduled work | Completion confirmation |
| `POST` | `/api/student/lessons/[id]/complete` | `STUDENT` | Exit-ticket answers | Lesson completion status and timestamp |
| `POST` | `/api/student/exams/[examId]/start` | `STUDENT` | Path param `examId` | Attempt ID, questions, time limit, title |
| `POST` | `/api/student/exams/[examId]/submit` | `STUDENT` | Attempt ID, answers, flags | Score, pass/fail result, optional certificate code |
| `GET` | `/api/student/adaptive/gaps` | `STUDENT` | Session only | Mastery gaps by strand and subject |
| `POST` | `/api/student/adaptive/practice` | `STUDENT` | `strandCode`, `difficultyTier` | Generated practice set |
| `POST` | `/api/student/adaptive/submit` | `STUDENT` | Practice answers and correct-answer map | Score, pass/fail, next tier |
| `POST` | `/api/student/tutor` | `STUDENT` | Subject, strand, request type, learning state | Grounded AI support response |

## Teacher

| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| `GET` | `/api/teacher/dashboard` | `TEACHER` | Session only | Dashboard totals, lesson schedule, adaptive stats |
| `GET` | `/api/teacher/students` | `TEACHER` | Session only | Teacher-scoped student roster |
| `GET` | `/api/teacher/students/[studentId]` | `TEACHER` | Path param `studentId` | Student detail within teacher scope |
| `GET` | `/api/teacher/intelligence/[studentId]` | `TEACHER` | Path param `studentId` | Student intelligence summary and interventions |
| `POST` | `/api/teacher/generate-lesson` | `TEACHER` | Lesson generation prompt and curriculum context | Draft lesson package |
| `POST` | `/api/teacher/lesson/improve` | `TEACHER` | Existing lesson plus revision intent | Improved lesson draft |
| `POST` | `/api/teacher/assignment/generate` | `TEACHER` | Assignment generation context | Assignment draft |
| `POST` | `/api/teacher/assist` | `TEACHER` | Classroom or instruction prompt | Teacher-assist response |
| `GET` | `/api/teacher/placements/[id]` | `TEACHER` | Path param `id` | Placement detail including question-by-question review |
| `POST` | `/api/teacher/placements/[id]/review` | `TEACHER` | Placement decision or teacher override | Placement review status |

## Guardian

| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| `GET` | `/api/guardian/students` | `GUARDIAN` | Session only | Linked students summary |
| `GET` | `/api/guardian/dashboard` | `GUARDIAN` | Session only | Child dashboard data, attendance, grades, alerts |
| `GET` | `/api/guardian/student/[studentId]` | `GUARDIAN` | Path param `studentId` | Child detail for a linked student |
| `GET` | `/api/guardian/performance` | `GUARDIAN` | Session only | Guardian-safe performance summary |
| `GET` | `/api/guardian/messages` | `GUARDIAN` | Session only | Guardian message feed |
| `POST` | `/api/guardian/messages/[id]/read` | `GUARDIAN` | Path param `id` | Read-state update |
| `POST` | `/api/guardian/study-plan` | `GUARDIAN` | Child context and support prompt | Suggested home study plan |
| `POST` | `/api/guardian/link` | `GUARDIAN` or invite flow | Linking token or child context | Guardian-student link result |

## School Admin

| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| `GET` | `/api/admin/students` | `ADMIN` | Session, school scope | School student list |
| `GET` | `/api/admin/students/[id]` | `ADMIN` | Path param `id` | Student detail for that school |
| `GET` | `/api/admin/teachers` | `ADMIN` | Session, school scope | Teacher roster and status |
| `POST` | `/api/admin/classes` | `ADMIN` | Class creation payload | Class record |
| `GET` | `/api/admin/curriculum/units` | `ADMIN` | Session only | School-visible curriculum unit data |
| `POST` | `/api/admin/exams/generate` | `ADMIN` | Exam generation payload | Draft exam |
| `POST` | `/api/admin/exams/[examId]/publish` | `ADMIN` | Path param `examId` | Published exam status |
| `GET` | `/api/admin/placements` | `ADMIN` | School scope filters | Placement list for the school |
| `GET` | `/api/admin/placements/[id]` | `ADMIN` | Path param `id` | Placement detail within school scope |
| `GET` | `/api/admin/metrics/product` | `ADMIN` | Optional period selector | Learning, engagement, and adoption metrics |

## Platform Admin

| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| `GET` | `/api/platform/schools` | `PLATFORM_ADMIN` | Session only | Cross-school inventory |
| `GET` | `/api/platform/stats` | `PLATFORM_ADMIN` | Session only | Platform-wide totals and operational stats |
| `GET` | `/api/platform/reports` | `PLATFORM_ADMIN` | Session only | Platform reporting summary |
| `POST` | `/api/platform/security/transfer` | `PLATFORM_ADMIN` | Transfer request payload | Transfer initiation result |
| `POST` | `/api/platform/security/accept` | `PLATFORM_ADMIN` | Transfer acceptance payload | Transfer completion status |
| `POST` | `/api/platform/security/demote` | `PLATFORM_ADMIN` | Demotion payload | Updated admin status |
| `POST` | `/api/platform/demo/reset` | `PLATFORM_ADMIN` in demo/dev only | Demo reset request | Demo environment reset result |
| `POST` | `/api/platform/demo/advance-day` | `PLATFORM_ADMIN` in demo/dev only | Demo clock action | Simulated day advancement |

## MOE and District Oversight

| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| `GET` | `/api/moe/dashboard` | `MOE_OFFICIAL` and approved oversight roles | Session only | National dashboard including product outcomes |
| `GET` | `/api/moe/curriculum-health` | `MOE_OFFICIAL` | Session only | Curriculum readiness and health summary |
| `GET` | `/api/moe/standards-coverage` | `MOE_OFFICIAL` | Session only | Standards coverage view |
| `GET` | `/api/moe/delivery-compliance` | `MOE_OFFICIAL` | Session only | Delivery and compliance metrics |
| `GET` | `/api/moe/intervention-impact` | `MOE_OFFICIAL` | Session only | Intervention impact data |
| `GET` | `/api/moe/placements` | `MOE_OFFICIAL` | Session only | Aggregate placement reporting |
| `GET` | `/api/moe/export/national` | `MOE_OFFICIAL` | Export request | National export payload |
| `GET` | `/api/moe/export/district/[district]` | `MOE_OFFICIAL`, district oversight | Path param `district` | District export payload |

## Shared Auth and Utility Surfaces

| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Credentials | Session establishment |
| `POST` | `/api/auth/forgot-password` | Public | Email or account identifier | Password reset issuance result |
| `POST` | `/api/auth/reset-password` | Public with token | Reset token and new password | Password reset result |
| `GET` | `/api/healthz` | Internal/public monitoring | None | Basic health response |
| `GET` | `/api/health/db` | Internal monitoring | None | Database health response |
| `POST` | `/api/track` | App clients | Event payload | Analytics/event acknowledgement |

## Notes for Reviewers

- Route authorization is role-aware and tenant-aware. Platform-admin access is not the same as school-admin access.
- Demo reset routes are intentionally blocked in production and staging.
- AI-backed routes are expected to use the routed AI layer rather than direct provider clients.
- This reference is intentionally concise. For exact implementation details, inspect the route handlers in [app/api](C:/Users/fasir/liberia-learn/app/api).
