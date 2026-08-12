# P0: LiberiaLearn Production RLS Exposure Audit and Safe Remediation

Status: P0 investigation required. No production mutation is authorized by
this document.

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
