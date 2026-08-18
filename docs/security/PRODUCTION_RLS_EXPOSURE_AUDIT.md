# P0: LiberiaLearn Production RLS Exposure Audit and Safe Remediation

Status: **P0 RLS EXPOSURE — CONTAINED** (2026-08-18)
- Default-deny RLS active in staging and production (216/216 production
  tables, 229/229 staging tables, zero policies).
- Post-exposure log/integrity review: see the 2026-08-18 record below for
  results.
- Fine-grained Data API policy matrix (the full process below) is deferred
  until a feature genuinely requires direct client-side Supabase access; not
  needed today because the app never uses `supabase-js`/PostgREST against
  Postgres (Storage API only, server-side).

## 2026-08-18 interim mitigation record

- Trigger: user forwarded a live Supabase dashboard security alert for the
  staging project (`yonpfzjczoffhrgibxkz`, "fasiryon's Project"), flagging
  `rls_disabled_in_public`.
- Staging discovery: all 229 public tables had RLS disabled AND `anon`/
  `authenticated` held full `SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,
  TRIGGER` grants on nearly every table — actively exploitable via the public
  anon key, not just a theoretical risk.
- Verified before fixing: `lib/supabaseStorage.ts` is the only Supabase client
  usage in the codebase, and it only calls the Storage REST API (never
  PostgREST/`supabase-js` against Postgres tables). `DATABASE_URL`/`DIRECT_URL`
  connect as the `postgres` role, which has `rolbypassrls = true`.
- Fix applied to staging: blanket `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
  across all public tables, no policies. Verified: `SET ROLE anon` reads 0
  rows from `User`; the `postgres` role still reads all real rows (87 users)
  unaffected — the app is unaffected.
- Production discovery (read-only, no mutation): RLS was disabled on all 216
  tables, confirming this document's original 2026-08-11 finding was still
  live. Distinguishing detail: unlike staging, `anon`, `authenticated`, and
  even `service_role` all lacked `USAGE` on schema `public` in production, so
  the standard Data API could not reach any table regardless of the RLS flag
  (`permission denied for schema public`) — production was not actively
  exploitable via that path at the time of this check, unlike staging.
- User explicitly approved applying the same interim fix to production as
  defense-in-depth (the schema-USAGE lock is a single misconfiguration away
  from reopening full exposure, with no RLS backstop).
- Fix applied to production: identical blanket `ENABLE ROW LEVEL SECURITY`,
  no policies. Verified post-change: 216/216 tables show `rowsecurity = true`;
  `postgres`-role read of `User` still returns all real rows (2,168 users) —
  app unaffected.
- Still open: the full discovery-and-policy-matrix process below (grant
  inventory across all roles, access-path map, PII/safeguarding table
  classification, per-table reviewed policies) was not performed. Default-deny
  is safe today only because no legitimate `anon`/`authenticated` Data API
  consumer exists. If any future feature needs that path, real policies must
  be designed and reviewed first — do not just add ad hoc `USING (true)`
  policies to "unblock" a table.

## Finding

On 2026-08-11, Supabase's read-only table inventory reported Row Level
Security disabled on 197 tables in the production project's `public` schema.
The production project reference is `bnphuinpvgpmebcsvmsp`.

This is a P0 risk signal, not proof that every table is anonymously readable.
Actual exposure depends on Data API schema exposure, PostgreSQL grants, API
keys and roles, and whether application traffic reaches PostgreSQL through
Supabase client roles or only through server-side Prisma connections.

## Required discovery

Before any RLS change, the security sprint must establish:

1. Which public tables and views are reachable through the Supabase Data API.
2. Exact table, sequence, function, and schema grants for `anon` and
   `authenticated`.
3. Every browser/client Supabase access path and every server-only access path.
4. Existing `service_role` use, storage integrations, background workers, and
   backend authorization boundaries.
5. Tables containing student, guardian, teacher, or school PII.
6. Authentication, identity-adjacent, safeguarding, consent, session, token,
   and audit data.
7. Financial, billing, provider, cost-accounting, and sensitive operational
   data.
8. Curriculum and public-content tables, including any intentionally public
   read surface.
9. Required tenant, role, ownership, and public-read policies for every
   exposed relation before RLS activation.
10. Dependencies that use database roles which bypass RLS and how those paths
    remain independently authorized.

## Safe remediation gate

The remediation plan must be staged and reversible:

1. Reproduce the production grants and Data API configuration in isolated
   staging without production rows.
2. Build an expected-access matrix for anonymous, authenticated, school roles,
   MOE roles, platform administrators, service-role jobs, and Prisma backend
   traffic.
3. Add policies in reviewed batches, beginning with the highest-sensitivity
   tables and explicit deny tests.
4. Prove cross-tenant denial and legitimate read/write behavior with automated
   integration tests and representative application walkthroughs.
5. Record query-performance impact and required indexes.
6. Define a rollback for each batch and rehearse it in staging.
7. Require security and founder review before any production activation.

## Prohibited shortcuts

- Do not issue bulk `ENABLE ROW LEVEL SECURITY` against production without
  complete policies and traffic verification.
- Do not weaken backend RBAC, tenant isolation, or audit requirements to make
  an RLS rollout pass.
- Do not copy production PII into staging for policy development.
- Do not assume server-side use alone makes public-schema grants harmless.

## Completion evidence

Close this P0 only with the grant inventory, access-path map, table
classification, reviewed policy matrix, staging test results, rollout and
rollback records, and production post-change verification.
