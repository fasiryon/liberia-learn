# LiberiaLearn Penetration Test Brief

Version: NR-9 | Date: 2026-05-22

## Scope

Target: https://liberia-learn.vercel.app  
Type: Grey-box web application test  
Duration: Recommended 5 business days

## Application Overview

National K-12 education platform for Liberia's Ministry of Education.  
~471 API routes, 5 user roles, live student PII in production.  
Stack: Next.js 14 App Router, Prisma, Supabase (Postgres), Vercel (serverless), Upstash Redis, AWS ECS/SQS.

## Authentication Flows to Test

1. **Credentials login** — email + bcrypt password via `/api/auth/signin`
2. **Google OAuth SSO** — `/api/auth/callback/google`  
   New accounts blocked unless a matching `SSO_INVITE` InviteToken exists for the email; `schoolId` is set from the invite (NR-8)
3. **Admin-generated 6-digit PIN recovery** — Sprint 18 flow
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

## Attack Surface Priorities

### P0 — Test First

- **Horizontal privilege escalation**: can STUDENT A access STUDENT B's grades/submissions by changing IDs in API calls?
- **Cross-school data access**: can a TEACHER from School A access School B's student data by changing `schoolId` or `classId` parameters?
- **MOE export PII leak**: do MOE aggregate exports contain individual student names, IDs, or disaggregated records (n < 5 threshold)?
- **Auth bypass**: can `/admin/*` or `/platform/*` pages be accessed without a valid session after the NR-6 middleware fix?
- **IDOR on portfolio/certificate verify**: `GET /api/verify/[credentialId]` — is it public by design, or does it leak unexpected PII?

### P1 — Test Second

- **JWT role manipulation**: can the `role` or `isPlatformAdmin` claim in the session JWT be tampered with or forged?
- **Google SSO invite bypass**: can a new user complete Google OAuth without a pre-issued `SSO_INVITE` token for their email?
- **Rate limit bypass**: can Upstash rate limits be circumvented via IP spoofing (`X-Forwarded-For` header injection)?
- **IDOR on student assessment history**: `GET /api/student/results`, `GET /api/teacher/students/[id]`
- **Guardian–student link confusion**: can a guardian view a student they are not linked to by guessing `studentId`?

### P2 — Test Third

- **SMS webhook spoofing**: `POST /api/webhooks/sms-reply` — does it validate sender signature? Can an attacker inject fake STOP or quiz responses?
- **Cron endpoint access without secret**: `POST /api/cron/*` routes — do all require `CRON_SECRET` header?
- **File upload abuse via Vercel Blob**: Sprint 13 attachments — can a user upload oversized files, traverse paths, or upload executable content?
- **AI tutor prompt injection**: `POST /api/student/tutor` — can user input escape the system prompt to extract internal instructions, student data, or admin context?
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
