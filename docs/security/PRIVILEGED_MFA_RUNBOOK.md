# Privileged MFA Runbook

## Scope

Auth0 is the managed MFA authority for ADMIN, DISTRICT_ADMIN, MOE_OFFICIAL,
MOE_SUPER_ADMIN, MOE_DISTRICT_ADMIN, and every `isPlatformAdmin` account.
LiberiaLearn stores identity linkage, a revocation version, and a server-side
session assurance ledger. It never stores MFA seeds or recovery codes.

Official Auth0 references:

- [MFA overview](https://auth0.com/docs/secure/multi-factor-authentication)
- [Web application step-up authentication](https://auth0.com/docs/secure/multi-factor-authentication/step-up-authentication/configure-step-up-authentication-for-web-apps)
- [Recovery codes](https://auth0.com/docs/secure/multi-factor-authentication/configure-recovery-codes-for-mfa)
- [Reset MFA and recovery codes](https://auth0.com/docs/secure/multi-factor-authentication/reset-user-mfa)

## Tenant configuration

1. Create a dedicated Regular Web Application in Auth0.
2. Allow these callback URLs for every deployed environment:
   - `https://HOST/api/auth/callback/auth0`
   - `https://HOST/api/auth/callback/auth0-step-up`
3. Disable public sign-up. Provision privileged users by verified email.
4. Enable at least WebAuthn and one-time password. Do not use email as the
   only factor.
5. Create a Post Login Action from
   `docs/security/auth0/require-privileged-mfa.js`, add the application client
   ID as the `LIBERIALEARN_CLIENT_ID` Action secret, deploy it, and attach it
   to the Login flow.
6. Create a Machine to Machine application with only
   `delete:authentication_methods` for the Auth0 Management API.
7. Set the Auth0 and P1-C variables documented in `.env.example` while
   leaving `PRIVILEGED_MFA_ENFORCEMENT_ENABLED=false`.
8. Apply migration `20260803_000001_privileged_identity_hardening`.

## Enrollment and activation

1. Ask every privileged user to select the secure administrator or MOE sign-in
   button and complete enrollment.
2. Confirm each expected user has `mfaEnrolledAt`, `providerSubject`, and at
   least one unrevoked `PrivilegedSessionAssurance` row.
3. Verify a local password attempt for a privileged user still works while the
   staged flag is false.
4. Set `PRIVILEGED_MFA_ENFORCEMENT_ENABLED=true` in Preview first and redeploy.
5. Verify local password access is denied, Auth0 MFA succeeds, and an export
   older than the step-up window returns HTTP 428 with a `stepUpUrl`.
6. Repeat in production with two platform security owners present.

Enforcement must not be enabled when Auth0 settings are absent. Runtime
environment validation fails in that state. Privileged session validation is
uncached and fails closed if its database-backed assurance cannot be read.

## Recovery

Auth0 rotates a recovery code after it is used. A user who loses both the
factor and recovery code requires a platform-admin reset:

```text
POST /api/admin/security/mfa/recovery/reset
{"targetUserId":"USER_ID","reason":"INCIDENT_OR_SUPPORT_TICKET_AND_REASON"}
```

The caller needs a recent MFA step-up. The route is limited to three attempts
per hour, writes a durable request audit before contacting Auth0, clears the
provider enrollment, increments `securityVersion`, revokes every local
privileged assurance, and requires a completion audit in the local database
transaction. The user must enroll again on the next sign-in.

## Break-glass

Break-glass is for a confirmed Auth0 outage only. It requires a platform-admin
actor, a separate recorded approver, a ticket or incident reason, an existing
local password, and a duration from 5 to 30 minutes. The operation increments
the security version, revokes existing privileged sessions, and writes a
required audit entry.

```powershell
$env:BREAK_GLASS_CONFIRM='AUTHORIZE_TIME_LIMITED_PRIVILEGED_BREAK_GLASS'
npm run security:break-glass -- grant --target-user-id USER_ID --actor-user-id ACTOR_ID --approved-by SECOND_APPROVER --reason INCIDENT_REFERENCE --minutes 15
```

Revoke it as soon as provider access returns:

```powershell
$env:BREAK_GLASS_CONFIRM='AUTHORIZE_TIME_LIMITED_PRIVILEGED_BREAK_GLASS'
npm run security:break-glass -- revoke --target-user-id USER_ID --actor-user-id ACTOR_ID --approved-by SECOND_APPROVER --reason INCIDENT_RESOLVED
```

Do not place the confirmation value in a persistent environment. Review the
immutable audit log after every use.

## Session invalidation checks

A privileged request is rejected when any of these differ from the signed
session: role, school, platform-admin state, password-change time, MFA security
version, assurance record, revocation state, or assurance expiry. MFA reset and
break-glass changes revoke all assurance rows transactionally.

## Rollback

If the managed provider is unavailable during initial activation, set
`PRIVILEGED_MFA_ENFORCEMENT_ENABLED=false` and redeploy. This restores the
previous credential path but removes MFA enforcement, so it is an incident
state, not a normal operating mode. Use the time-limited audited break-glass
path when the application and database remain available.
