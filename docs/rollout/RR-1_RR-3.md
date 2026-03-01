# RR-1 Enrollment Invites + RR-3 Account Recovery

## Flags
- `ENABLE_ENROLLMENT_INVITES` (server)
- `ENABLE_ACCOUNT_RECOVERY` (server)
- Optional client mirrors: `NEXT_PUBLIC_ENABLE_ENROLLMENT_INVITES`, `NEXT_PUBLIC_ENABLE_ACCOUNT_RECOVERY`

## RR-1: Enrollment & Invite System

### New Routes
- `POST /api/rollout/invite/teacher` (Admin or platform admin)
- `POST /api/rollout/invite/student` (Teacher)
- `POST /api/rollout/invite/student/bulk` (Teacher)

### Behavior
- Tokens are school-bound, expiring, single-use.
- New token types: `ENROLL_TEACHER`, `ENROLL_STUDENT`.
- `/api/onboard/accept` now accepts ENROLL tokens (flag-gated).
- Audit logging:
  - `invite.created`
  - `invite.accepted`
  - `invite.accept.failed`

### Tenant Isolation
- Invites created with the caller's `schoolId`.
- Acceptance uses `InviteToken.schoolId` to create the user for that tenant.

## RR-3: Account Recovery + Session Safety

### Recovery
- `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` are flag-gated.
- Non-enumerating forgot response remains unchanged.
- Rate limiting via `lib/rateLimit.ts`:
  - Forgot: per-IP + per-email.
  - Reset: per-IP.
- Audit logging:
  - `auth.password_reset.requested`
  - `auth.password_reset.completed`
  - `auth.password_reset.failed`

### Session Safety (JWT)
- User model adds `passwordChangedAt`.
- `requireUser()` / `requireRole()` deny sessions where JWT `iat` is older than `passwordChangedAt`.
- Password reset updates `passwordChangedAt` and deletes DB `Session` rows.

### Token Hashing
- `InviteToken.tokenHash` and `PasswordResetToken.tokenHash` added.
- New tokens are stored as hashes; lookups fall back to raw token for legacy records.

## Schema / Migrations
- `User.passwordChangedAt` (nullable).
- `InviteToken.tokenHash` (nullable, unique).
- `PasswordResetToken.tokenHash` (nullable, unique).

## Tests
- Enrollment invite routes: role checks, tenant binding, token expiry, single-use, bulk summary, flag-off.
- Account recovery: non-enumerating forgot, rate limit 429, token expiry / reuse, flag-off.
- Session invalidation: stale JWT blocked.
