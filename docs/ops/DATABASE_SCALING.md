# Database Scaling

## Current State

LiberiaLearn currently runs Prisma against Supabase with:
- `DATABASE_URL` for runtime traffic
- `DIRECT_URL` for migration and direct administrative operations

The Prisma datasource wiring is defined in [`prisma/schema.prisma`](C:\Users\fasir\liberia-learn\prisma\schema.prisma), and runtime client initialization is centralized in [`lib/db.ts`](C:\Users\fasir\liberia-learn\lib\db.ts).

The main operational constraint today is direct connection pressure. Without pooled runtime connections, practical concurrency is limited well before national traffic levels.

## Enabling PgBouncer

1. In Supabase, obtain the pooled runtime connection string.
2. Set `DATABASE_URL` to the pooled URL.
3. Keep `DIRECT_URL` pointed at the direct database URL for Prisma migrations and maintenance tasks.
4. Redeploy the application so all serverless/runtime traffic uses the pooled URL.
5. Run health checks and confirm no Prisma connection errors under normal app traffic.

This matches the existing production guidance in [`docs/rollout/PRODUCTION_DEPLOY_GUIDE.md`](C:\Users\fasir\liberia-learn\docs\rollout\PRODUCTION_DEPLOY_GUIDE.md).

## Connection String Format

Runtime pooled URL:

```bash
DATABASE_URL="postgresql://postgres.<ref>:<pass>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

Direct migration URL:

```bash
DIRECT_URL="postgresql://postgres.<ref>:<pass>@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

Rules:
- `DATABASE_URL` must be the pooled runtime URL
- `DIRECT_URL` must remain direct for migration correctness
- Do not point Prisma migrations at the pooled transaction URL

## When To Upgrade

Trigger a scaling change when any of the following becomes true:
- `100+` schools are active in the same rollout window
- queue backlog grows persistently during the school day
- export jobs materially slow interactive admin traffic
- Prisma connection or timeout errors appear during normal classroom hours
- DB saturation becomes a recurring incident class

## Operational Guidance

- Keep web traffic on pooled connections
- Keep migrations and one-off admin tasks on direct connections
- Monitor query latency, connection exhaustion, and error spikes together
- Treat export-heavy periods as separate capacity events, not normal steady state

## RDS Migration Path

RDS migration remains a later rollout step, not a current sprint action.

Suggested path:
1. Stabilize pooled Supabase runtime traffic first
2. Validate dual-write infrastructure using `RDS_DATABASE_URL` only in controlled environments
3. Rehearse cutover and rollback before district-wide rollout
4. Move national production to a higher-capacity managed database tier only after pooled Supabase becomes the binding constraint

## Decision Summary

Short term:
- stay on Supabase
- enable pooled runtime connections
- monitor saturation aggressively

Long term:
- use RDS migration as the national-rollout step once pilot and district-scale evidence justifies the complexity
