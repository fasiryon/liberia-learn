# OPS Enable RR-1 + RR-3

## Vercel Environment Variables
Set these for Production (and Preview if needed):
- ENABLE_ENROLLMENT_INVITES=true
- ENABLE_ACCOUNT_RECOVERY=true
- NEXT_PUBLIC_ENABLE_ENROLLMENT_INVITES=true
- NEXT_PUBLIC_ENABLE_ACCOUNT_RECOVERY=true

## Rollout Order
1. Deploy code (this script) with flags OFF (default false).
2. Run DB migration in production.
3. Enable ENABLE_ACCOUNT_RECOVERY, validate forgot/reset flow.
4. Enable ENABLE_ENROLLMENT_INVITES, validate teacher + student invites.
5. Optionally enable NEXT_PUBLIC mirrors for any UI gating.

## Validation Checklist
- Confirm invite acceptance rejects cross-tenant tokens.
- Confirm invite tokens are single-use + expire.
- Confirm reset tokens are single-use + expire.
- Confirm stale sessions are rejected after password reset.
- Confirm audit logs are created for invite + recovery events.
