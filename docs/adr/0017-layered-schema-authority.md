# ADR 0017: Layered Schema Authority

Status: Accepted

Date: 2026-08-20

## Decision

LiberiaLearn uses a layered database authority model:

1. `prisma/schema.prisma` owns application-facing models, fields, relations,
   native type declarations, and generated client types only when executable
   migration support exists.
2. `prisma/canonical/migrations` owns ordered, deployable physical history.
3. `prisma/canonical/postgres-object-manifest.json` owns PostgreSQL objects
   Prisma cannot or should not reproduce, including functions, triggers,
   specialized indexes, raw integrity constraints, RLS, grants, and extension
   allowlists.
4. `prisma/canonical/schema-authority-registry.json` owns each reviewed
   declarative-to-physical difference. Exceptions are exact object records,
   never wildcard allowances.
5. Production and staging are conformance evidence, not design authorities.

## Enforcement

The complete empty PostgreSQL 17 verifier:

- applies every canonical migration in order;
- executes the one frozen concurrent-index migration outside a transaction and
  records the canonical checksum through Prisma;
- checks ordered ledger names and migration-file checksums;
- verifies 229 public tables with RLS enabled and zero direct P2-C browser
  grants;
- fingerprints all required PostgreSQL-only objects;
- parses Prisma's application-layer SQL diff into exact structured keys;
- fails on every unregistered or stale difference; and
- runs the production P2-C reference seed twice and requires identical table
  fingerprints after the second run.

Registered destructive differences are preservation instructions, not approval
to execute the generated SQL. In particular, no Prisma-generated operation may
drop `TrendSnapshot`, a manifest index, a P2-B composite qualification foreign
key, or a populated physical column.

## Reconciled application fields

- `User.welcomeCompletedAt` is declared as an optional `timestamp(3)` field.
  Existing values are preserved without a data migration.
- `InterventionRecommendation.updatedAt` is supplied by the additive
  `20260820_000003_layered_schema_additive_reconciliation` migration as a
  required `timestamp(3)` with `CURRENT_TIMESTAMP` for existing and non-Prisma
  inserts. Prisma continues to maintain it through `@updatedAt`.
- Four known timezone-aware columns now carry `@db.Timestamptz(6)` annotations;
  no physical type conversion is authorized.

## Defaults

- Database `now()` insertion fallbacks plus Prisma `@updatedAt` are approved
  declarative differences.
- Empty-array database defaults are approved physical fallbacks.
- Seven database UUID fallbacks remain explicit exceptions while Prisma writes
  CUIDs. Removing them requires writer inventory evidence.
- `CapstoneProject.status` converges additively to the shipped application
  initial state `DRAFT`. The migration changes only the default and does not
  rewrite rows.

## Deferred index designs

The following Prisma-only designs are `DEFER`, not automatic additions:

- `Attendance_markedById_date_idx`
- `Exam_schoolId_status_grade_idx`
- `Exam_academicYearId_classId_idx`

The audited tables are currently empty and no shipped query proves these exact
column orders. Reconsider after representative workload telemetry and `EXPLAIN`
evidence exist.

## Security environments

Production's direct `anon` and `authenticated` grant target is zero unless a
specific Data API use is approved. Staging's previously observed 3,024 direct
grants across non-P2-C tables are tracked as security drift. No current feature
has been shown to require them. Revocation requires a separate identity-guarded
preflight and is not bundled into schema convergence.

## Unresolved roles

`MOE_SUPER_ADMIN` and `MOE_DISTRICT_ADMIN` remain declarative-only, blocked from
database persistence, and require the founder decision in ADR 0016. This ADR
does not authorize role DDL.

## Feature state

This authority model does not activate P2-C. The current deliverable remains a
deployed data/schema/library foundation whose runtime consumer is not wired.
`P2C_CURRICULUM_BENCHMARKING_ENABLED` must remain false or absent.
