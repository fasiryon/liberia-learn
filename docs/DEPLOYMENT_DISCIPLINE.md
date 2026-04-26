# LiberiaLearn — Deployment Rules

## School Hours Protection
NEVER deploy to production during Liberian school hours.
School hours: Monday–Friday, 8:00 AM – 3:00 PM GMT

Current time in Liberia is GMT (no daylight saving).

## Safe Deployment Windows
- Weekdays: before 7:30 AM GMT or after 3:30 PM GMT
- Weekends: any time

## Deployment Methods
GitHub push to main → Vercel auto-deploy (preferred)
This uses only committed code. Always prefer this.

`npx vercel --prod --force` → only from clean working tree
Run `git status` before. If any untracked files exist, stash or commit them first.
Dirty working tree = failed deploy (learned in 5.3.1)

## Before Every Production Deploy
1. `git status` — working tree must be clean
2. All 4 CI workflows green on latest main
3. `tsc --noEmit` passes locally
4. Staging verification if feature is significant

## Rollback
```
npx vercel rollback [deployment-url]
```
Or via Vercel dashboard → Deployments → Instant Rollback

## Emergency Contacts
If platform is down during school hours:
1. Check Vercel status: vercel.com/status
2. Check Sentry for error volume spike
3. Rollback to last known good deployment
4. Notify school administrators

## Branch Strategy
```
main        → production (auto-deploy)
feat/*      → feature development
fix/*       → bug fixes
```
All changes go through feature branch → PR → main
