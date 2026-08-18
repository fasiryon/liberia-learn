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

## 2026-08-18 post-mitigation verification pass

**Security Advisor rerun (both projects).** `rls_disabled_in_public`: 0/0.
The pasted dashboard alert's second item, `sensitive_columns_exposed`, is not
a real Supabase lint ID — it appears nowhere in either project's live advisor
output and should be treated as unverified dashboard text, not a finding.
Expected new INFO-level noise: `rls_enabled_no_policy` on every table in both
projects (216 production, 229 staging) — this is the intended, harmless
consequence of default-deny RLS with no policies yet.
Residual staging-only WARN: `pg_graphql_anon_table_exposed` /
`pg_graphql_authenticated_table_exposed` on all 229 staging tables — the
GraphQL schema still lists table/column *names* as visible to the anon key
(schema disclosure only; RLS already blocks row data). Production has zero of
these because `anon`/`authenticated` lack schema `USAGE` there. Not fixed this
pass; low severity, tracked as follow-up (see below). Pre-existing, unrelated
to this incident: `extension_in_public` (the `vector` extension lives in
`public`) and `function_search_path_mutable` (14 functions) on both projects —
generic Supabase hardening items, not part of this exposure.

**Staging API log review, exposure window.** Log retention on this project
only reaches back to **2026-08-17T17:13Z** (~24h) — nowhere near the actual
exposure window since project creation (2025-10-24). There is no `edge_logs`/
API-gateway log source on this project at all, so no historical HTTP-level
REST/GraphQL request log ever existed to review. Within the retained window:
`postgrest_logs` contained only internal service messages (schema cache
reloads, DB reconnects) with zero real API request entries; `postgres_logs`
contained only P2-C migration DDL, routine checkpoints, one ordinary client
disconnect, and this session's own `apply_migration` calls (tagged
`source: POST /mcp`); `supavisor_logs` (connection pooler) showed every
connection authenticating as `user: "postgres"` — no `anon`/`authenticated`
connections appear anywhere in the retained window. Conclusion: no log
evidence of exploitation in the last ~24h; **historical exposure before that
cannot be verified or ruled out from logs** — retention does not go back far
enough. This is a real, unresolved gap, not a clean bill of health.

**Sensitive-table integrity check (both projects, via the `postgres` role,
which bypasses RLS).** Production: role distribution is
STUDENT 1988 / GUARDIAN 144 / TEACHER 23 / ADMIN 11 / MOE_OFFICIAL 2, all
ADMIN/MOE_OFFICIAL accounts created February-July 2026 (none recent/rogue);
zero `PrivilegedIdentity` rows have ever used `breakGlassUntil`/
`breakGlassReason`; 0 `PasswordResetToken` and 0 `InviteToken` rows created in
the trailing 7 days; `AuditLog` (1,710 rows, 7-day window) contains only
routine `cron.audio.generation.run`, `cron.textbook.generation.run`, and
curriculum-governance actions — no privilege-escalation or bulk-export
signatures. Staging: role distribution TEACHER 70 / ADMIN 17, zero break-glass
usage, `AuditLog` (471 rows, full history 2026-08-13 to 08-14) is entirely
reviewer-credential onboarding and P2A/P2B e2e-test actions. No anomalies
found in either project. Same caveat as the log review: `AuditLog` only
covers what the app itself writes and only as far back as it has rows for —
it is not a substitute for infrastructure-level access logs.

**Service-role/secret key exposure.** Confirmed clean: `SUPABASE_SERVICE_ROLE_KEY`
never appears with a `NEXT_PUBLIC_` prefix anywhere in the repo; every
consumer (`lib/supabaseStorage.ts`, two API routes, three scripts) is
server-only code, never a `"use client"` component. Only `NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are ever public, which is by design (the
anon key is meant to be public; RLS is the actual gate). `git log --all
--diff-filter=A` for `.env`/`.env.local`/`.env.production`/`.env.staging`
found zero real env files ever committed — only `.env.example` templates.

**Default-privilege guardrail (the "future table" footgun).** Confirmed via
`pg_default_acl`: staging had default ACL entries granting full
`SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER` to `anon` and
`authenticated` on every table/sequence the `postgres` role would ever create
in `public` in the future — meaning the *next* Prisma migration would have
silently recreated this exact vulnerability. Production already had zero such
default ACL entries (already hardened, consistent with its missing schema
`USAGE` grants). Fixed on staging:
`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES/SEQUENCES FROM anon, authenticated;`
(run as `postgres`, matching the role Prisma migrations actually use).
Verified via `pg_default_acl` re-check: the `postgres`-owned default ACL no
longer includes `anon`/`authenticated`. A separate `supabase_admin`-owned
default ACL entry still grants them access to tables *supabase_admin* creates
in the future — this is a Supabase platform-managed default we don't have
permission to change (`permission denied to change default privileges`), and
it isn't the realistic attack path since Prisma/raw-SQL migrations run as
`postgres`, not `supabase_admin`.
Attempted, not possible: an event trigger to auto-`ENABLE ROW LEVEL SECURITY`
on every new table (Postgres has no built-in "RLS on by default"). Failed:
`permission denied to create event trigger ... Must be superuser` — Supabase's
`postgres` role is not a true superuser. Fallback guardrail added instead:
`scripts/verify-rls-invariant.ts` — run it (`npx tsx scripts/verify-rls-invariant.ts`
against `DATABASE_URL`/`DIRECT_URL`) after every migration to staging or
production; it fails closed and lists any public table with RLS disabled.
This is not wired into the automatic `npx vitest run` gate (it needs live DB
credentials, which must never be required for a contributor's local test run)
— it must be run manually or from a deploy pipeline as a preflight step,
matching the existing `p2a-staging-preflight.ts` / `p2b-production-preflight.ps1`
pattern.

**Not done this pass:** revoking staging's `pg_graphql_*_table_exposed` WARNs
(would mean revoking the underlying `SELECT`/etc. grants on staging, matching
production's posture — low severity today since RLS already blocks row data,
tracked as follow-up); wiring `verify-rls-invariant.ts` into an actual deploy
pipeline step (script exists, not yet invoked anywhere).

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
