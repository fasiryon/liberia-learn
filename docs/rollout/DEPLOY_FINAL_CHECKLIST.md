# LiberiaLearn Production Deploy Final Checklist

Numbered, operator-executable steps. Run in order.

## Pre-deploy (local)

1. `git checkout main && git pull --ff-only`
2. `npm ci`
3. `npx prisma generate`
4. `npm test` (must be 1174+ with zero failures)
5. `npm run build` (must be clean)

## Supabase setup

6. Create Supabase project and copy connection strings.
7. Set all environment variables (reference `docs/rollout/ENV_VARS.md`).
8. Run: `npx prisma migrate deploy`
9. Verify: `npx prisma migrate status` (all 24 migrations finished)
10. Run: `npm run seed:demo` (staging only, not production)
11. Run `alignAllContent()` post-seed for ENGINEERING codes.

## Vercel setup

12. Import repo to Vercel project.
13. Set all environment variables in Vercel dashboard (reference `docs/rollout/ENV_VARS.md`).
14. Set `NODE_ENV=production`.
15. Set `NEXTAUTH_SECRET` to: `openssl rand -base64 32`
16. Set `NEXTAUTH_URL` to production domain.
17. Deploy: `vercel --prod`
18. Verify build logs show zero errors.

## Post-deploy verification (run within 30 minutes)

19. `GET /api/health` -> `{ "status": "healthy" }`
20. Run all 15 smoke tests from `docs/rollout/PRODUCTION_DEPLOY_GUIDE.md` (Section 5).
21. Login as MOE official at `/moe/login` and confirm dashboard loads.
22. Confirm Vercel logs show zero 5xx errors.
23. Confirm Sentry shows zero new error events.

## Rollback trigger

If any smoke test fails: execute `docs/rollout/ROLLBACK_RUNBOOK.md` immediately.  
Do not attempt to patch in production.

## Before enabling public registration

- Replace `lib/rateLimit.ts` with Upstash Redis implementation.
- Add Vercel Firewall rules for `/api/auth/*` routes.
- Set `MOE_PORTAL_ALLOWLIST=@moe.gov.lr`.
