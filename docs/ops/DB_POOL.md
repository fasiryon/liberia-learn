# DB Connection Pool — Operations Guide

## Overview

LiberiaLearn uses **Supabase Postgres** with **PgBouncer** (transaction-mode pooling)
as the external connection pool. Each Vercel serverless function instance holds
exactly **one** connection to PgBouncer; PgBouncer then manages the physical
connections to Postgres.

---

## Connection Strategy

### DATABASE_URL (pooled — used by Prisma)

```
postgresql://user:pass@db.xxx.supabase.co:6543/postgres
  ?pgbouncer=true
  &connection_limit=1
  &pool_timeout=20
```

| Parameter          | Value | Reason                                                                 |
|--------------------|-------|------------------------------------------------------------------------|
| `pgbouncer=true`   | true  | Disables prepared statements (incompatible with PgBouncer transaction mode) |
| `connection_limit` | 1     | Each serverless instance holds 1 connection; PgBouncer handles pooling |
| `pool_timeout`     | 20    | Wait up to 20s for a pool slot before failing the request              |

`connection_limit=1` is **intentional and correct** for serverless deployments.
Raising it would cause connection exhaustion because Vercel may spin up hundreds
of concurrent function instances.

### DIRECT_URL (non-pooled — used by Prisma migrations only)

```
postgresql://user:pass@db.xxx.supabase.co:5432/postgres
```

Used exclusively by `prisma migrate deploy`. Never used in runtime code.

---

## Why PgBouncer?

Postgres itself supports ~100–200 simultaneous connections before performance
degrades. With 500+ concurrent Vercel function instances each holding 1
connection, a direct connection model would exceed Postgres limits immediately.

PgBouncer in **transaction mode** multiplexes function connections onto a much
smaller physical connection pool (Supabase default: 15–25 connections,
configurable up to 200+ on Pro).

---

## Query Timeout Middleware

`lib/db.ts` includes an 8-second Prisma middleware timeout:

```typescript
prismaWithTimeout.$use(async (params, next) => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("DB query timeout after 8000ms")), 8_000)
  );
  return Promise.race([next(params), timeout]);
});
```

This surfaces slow queries as 500 errors rather than hanging requests for up to
the 300s function timeout. See `docs/ops/QUERY_TIMEOUTS.md` for investigation steps.

---

## Monitoring

| Signal                          | Where to look                                      |
|---------------------------------|----------------------------------------------------|
| Active connections gauge         | Supabase dashboard → Database → Connections        |
| Slow queries (> 1s)             | Supabase dashboard → Database → Query Performance  |
| Pool timeout errors             | Vercel function logs (`pool_timeout`)              |
| DB timeout middleware errors    | Vercel logs (`DB query timeout after 8000ms`)      |

### Alert thresholds

- **Active connections > 80% of pool capacity** → scale Supabase plan or reduce pool_timeout
- **> 5 pool timeout errors per minute** → investigate N+1 queries or add DB indexes
- **> 1% of requests hit the 8s timeout** → check Query Performance for slow queries

---

## Scaling for National Rollout (5,000 concurrent users)

At 5,000 concurrent users the expected Vercel function concurrency is ~200–500
instances (Fluid Compute reuse reduces this significantly). Each instance holds
1 connection, so maximum simultaneous connections to PgBouncer = ~500.

Supabase Pro supports up to 200 physical connections to Postgres. PgBouncer at
500 incoming connections × 200 physical = **2.5× multiplexing** — acceptable for
the expected query duration of < 50ms per query.

If connections become saturated: upgrade to Supabase Pro (dedicated compute)
and set `SUPABASE_PGBOUNCER_MAX_CONNECTIONS` to a higher value in the dashboard.
