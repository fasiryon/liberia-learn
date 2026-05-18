# Query Timeout Enforcement — Operations Guide

## Timeout Layers

| Layer                        | Timeout | Location                          |
|------------------------------|---------|-----------------------------------|
| Prisma query middleware       | 8s      | `lib/db.ts`                       |
| AI provider (standard)        | 30s     | `lib/ai/routedCompletion.ts`      |
| AI provider (elite curriculum)| 240s    | `lib/ai/routedCompletion.ts`      |
| Vercel function maximum       | 300s    | Vercel Pro default                |

## Prisma 8-Second Query Timeout

Registered in `lib/db.ts` as a `$use` middleware:

```typescript
prismaWithTimeout.$use(async (params, next) => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("DB query timeout after 8000ms")), 8_000)
  );
  return Promise.race([next(params), timeout]);
});
```

When a query exceeds 8s, the middleware rejects with `"DB query timeout after 8000ms"`.
The API route's error handler converts this to a 500 response. The 8s limit is
intentionally well below the Vercel function timeout (300s) so timeouts surface
quickly rather than stalling the entire request pipeline.

## Identifying Slow Queries

1. **Vercel logs** — search for `"DB query timeout"` to find which routes are affected.
2. **Supabase → Database → Query Performance** — sort by `mean_exec_time` descending.
   Any query averaging > 2s should be investigated.
3. **Common causes:**
   - Missing index on a filtered column (add via Prisma migration)
   - N+1 pattern (use `include` / `select` with nested relations)
   - Large `findMany` without `take` limit
   - `count()` on a table without a matching index

## Remediation Steps

| Symptom                              | Remedy                                              |
|--------------------------------------|-----------------------------------------------------|
| Timeout on a filtered query          | Add composite index in Prisma schema                |
| Timeout on aggregate (count/sum)     | Add partial index or pre-compute in cron            |
| Timeout on list endpoint             | Add `take` + cursor-based pagination                |
| Timeout on MOE dashboard             | Extend Redis TTL to reduce DB call frequency        |

## Route-Level Abort Pattern

For API routes that call external services (AI, SMS), use `AbortController` to
enforce an independent timeout that cancels the entire request chain:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10_000);
try {
  const res = await fetch(externalUrl, { signal: controller.signal });
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

AI routes in this codebase already pass `AbortSignal.timeout(timeoutMs)` directly
to the OpenAI and Groq SDK calls — see `lib/ai/routedCompletion.ts`.
