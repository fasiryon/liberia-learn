# Incident Response (V1)

## Severity
- SEV1: platform down, data leak risk, tenant boundary compromise
- SEV2: major workflows broken (login, grading, sync)
- SEV3: degraded performance, partial outages, SMS issues

## SEV1 Immediate Actions
- enable degraded mode
- disable risky subsystems via flags (AI generation, bulk messaging)
- preserve logs and audit trail
- communicate status to affected schools

## Post-Incident
- root cause summary
- prevention tasks
- tests added
- documentation updated

## Emergency Rollback

If a bad deploy reaches production:

Option A - Revert last commit:

```bash
git revert HEAD --no-edit
git push origin main
```

Vercel auto-deploys the reverted `main` commit in about 2 minutes.

Option B - Vercel instant rollback:

1. Open `vercel.com`
2. Select the LiberiaLearn project
3. Open `Deployments`
4. Select the previous healthy deployment
5. Click `Promote`

This is the fastest rollback path when the issue is isolated to the latest deployment artifact.

Option C - Pin to known good commit:

```bash
git checkout <good-sha>
git checkout -b emergency-fix
git push origin emergency-fix
```

Deploy the `emergency-fix` branch in Vercel when `main` needs investigation before another production push.
