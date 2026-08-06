# LiberiaLearn Penetration Test Brief

Version: P1-D | Date: 2026-08-05 (supersedes NR-9 version of 2026-05-22;
scope additions below are appended, original NR-9 scope is unchanged and
still current)

## Scope

Target: https://liberia-learn.vercel.app  
Type: Grey-box web application test  
Duration: Recommended 5 business days

## Application Overview

National K-12 education platform for Liberia's Ministry of Education.  
~471 API routes, 5 user roles, live student PII in production.  
Stack: Next.js 14 App Router, Prisma, Supabase (Postgres), Vercel (serverless), Upstash Redis, AWS ECS/SQS.

## Authentication Flows to Test

1. **Credentials login**: email + bcrypt password via `/api/auth/signin`
2. **Google OAuth SSO**: `/api/auth/callback/google`
   New accounts blocked unless a matching `SSO_INVITE` InviteToken exists for the email; `schoolId` is set from the invite (NR-8)
3. **Admin-generated 6-digit PIN recovery**: Sprint 18 flow
4. **Session**: NextAuth JWT in `__Secure-next-auth.session-token` cookie (httpOnly, Secure, SameSite=Lax)

## User Roles and Portals

| Role            | Portal        | Key Permissions                          |
|-----------------|---------------|------------------------------------------|
| `STUDENT`       | `/student/*`  | Own data only                            |
| `TEACHER`       | `/teacher/*`  | Own school students only                 |
| `GUARDIAN`      | `/guardian/*` | Linked children only                     |
| `ADMIN`         | `/admin/*`    | Own school data only                     |
| `MOE_OFFICIAL`  | `/moe/*`      | National aggregates, no individual PII   |
| isPlatformAdmin | `/platform/*` | Full access (Anthropic staff gate)       |

## Demo Accounts for Testing

```
student1@cha.edu.lr   / DemoSeed2026!
teacher1@cha.edu.lr   / DemoSeed2026!
admin@cha.edu.lr      / DemoSeed2026!
official1@moe.gov.lr  / MOESeed2026!
```

**Before handoff to any vendor: re-verify these passwords against the live
bcrypt hash in production, not this document.** Demo credentials have
drifted silently from written docs before (see project memory
`feedback_demo_credential_verification.md`). This brief was not re-verified
against live state as part of this P1-D update.

## Privileged Identity / MFA (added P1-D, 2026-08-05)

`codex/privileged-mfa-hardening` (PR #80, merged) added Auth0-managed MFA,
step-up authentication, and a break-glass procedure for `ADMIN`,
`DISTRICT_ADMIN`, MOE roles, and platform administrators. As of this brief,
`PRIVILEGED_MFA_ENFORCEMENT_ENABLED` is **not yet turned on in production**
(see `docs/roadmaps/CURRENT_EXECUTION_STATE.md`); confirm its live state
with the LiberiaLearn team before testing, since enforcement-off vs.
enforcement-on changes which of the following are reachable:

- **Auth0 MFA claim forgery**: can the `acr`/MFA claims in an Auth0 `id_token`
  be spoofed or replayed to satisfy `parseAuth0MfaClaims` without real MFA
  (`lib/auth/auth0Claims.ts`, checked in `lib/auth.ts` `signIn` callback)?
- **Step-up bypass**: once enforcement is on, can a privileged mutation
  (`/api/admin/curriculum/approve`, `/api/platform/security/*`, national
  exports) be reached without a fresh `/auth/step-up` challenge via replayed
  session token, race condition, or a route missing the
  `assertRecentPrivilegedStepUp`/`requirePrivilegedStepUp` check
  (`lib/auth/privilegedIdentity.ts`, `middleware.ts`)?
- **Session-assurance drift**: does a stale `securityVersion` or an expired/
  revoked `PrivilegedSessionAssurance` row still pass `assertSessionFresh`?
- **Break-glass abuse**: is `scripts/manage-privileged-break-glass.ts`
  reachable only via authorized operator access (it is a CLI script, not an
  HTTP route; confirm no HTTP wrapper exists); can the actor/approver/target
  separation or the 5-30 minute window be circumvented?
- **Recovery-code reset abuse**: is `POST /api/admin/security/mfa/recovery/reset`
  rate-limited and audited per `PRIVILEGED_MFA_RUNBOOK.md`?

## Attack Surface Priorities

### P0: Test First

- **Horizontal privilege escalation**: can STUDENT A access STUDENT B's grades/submissions by changing IDs in API calls?
- **Cross-school data access**: can a TEACHER from School A access School B's student data by changing `schoolId` or `classId` parameters?
- **MOE export PII leak**: do MOE aggregate exports contain individual student names, IDs, or disaggregated records (n < 5 threshold)?
- **Auth bypass**: can `/admin/*` or `/platform/*` pages be accessed without a valid session after the NR-6 middleware fix?
- **IDOR on portfolio/certificate verify**: is `GET /api/verify/[credentialId]` public by design, or does it leak unexpected PII?

### P1: Test Second

- **JWT role manipulation**: can the `role` or `isPlatformAdmin` claim in the session JWT be tampered with or forged?
- **Google SSO invite bypass**: can a new user complete Google OAuth without a pre-issued `SSO_INVITE` token for their email?
- **Rate limit bypass**: can Upstash rate limits be circumvented via IP spoofing (`X-Forwarded-For` header injection)?
- **IDOR on student assessment history**: `GET /api/student/results`, `GET /api/teacher/students/[id]`
- **Guardian–student link confusion**: can a guardian view a student they are not linked to by guessing `studentId`?

### P2: Test Third

- **SMS webhook spoofing**: does `POST /api/webhooks/sms-reply` validate sender signature? Can an attacker inject fake STOP or quiz responses?
- **Cron endpoint access without secret**: do all `POST /api/cron/*` routes require the `CRON_SECRET` header?
- **File upload abuse via Vercel Blob**: for Sprint 13 attachments, can a user upload oversized files, traverse paths, or upload executable content?
- **AI tutor prompt injection**: can input to `POST /api/student/tutor` escape the system prompt to extract internal instructions, student data, or admin context?
- **Audit log tampering**: attempt direct Postgres `UPDATE`/`DELETE` on the `AuditLog` table; DB-level triggers (NR-9) must reject it.

## Known Fixed Issues

Do not re-report unless a bypass is demonstrated.

| ID   | Issue                                            | Fixed in |
|------|--------------------------------------------------|----------|
| NR-6 | Middleware auth bypass on `/admin`, `/platform`  | NR-6     |
| NR-8 | Google SSO orphan account creation               | NR-8     |
| NR-8 | `assertPermission` missing on governance routes  | NR-8     |
| NR-9 | Audit log app-layer-only immutability            | NR-9     |
| NR-1 | In-memory rate limit fallback                    | NR-1     |
| S16B | Hardcoded JWT_SECRET fallback in login route     | Sprint 16B |
| S16B | Password reset token plaintext query             | Sprint 16B |
| NR-7 | 3 cross-tenant data-access findings              | NR-7     |
| NR-8 | RBAC gaps, 11 route fixes + SSO hardening        | NR-8     |
| P1-A | Minor-facing AI moderation could fail open on classifier UNCERTAIN | P1-A |
| P1-B | Cross-school lesson-video activation/read; offline cache ignored HTTP rejection and revocation | P1-B |

## Out of Scope

- ECS worker infrastructure (internal, no public endpoints)
- Supabase infrastructure (managed by Supabase)
- Vercel platform infrastructure (managed by Vercel)
- Load/DDoS testing (covered by NR-4/NR-5 internal tests)
- Social engineering or phishing

## Deliverables Expected

- CVSS-scored findings report (Critical/High/Medium/Low)
- Proof of concept for any Critical or High findings
- Retest opportunity after fixes are applied
- Raw HTTP request/response evidence for each finding
