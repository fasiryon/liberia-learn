-- P2-C production cutover: AIInteraction.dedupeKey unique index,
-- applied CONCURRENTLY because AIInteraction is a live, actively-written
-- production table (13,562 rows at last preflight, all dedupeKey NULL).
--
-- This mirrors the proven precedent already in this same PR for the same
-- table: prisma/canonical/migrations/20260810_000003_p2a_ai_generation_correlation_index
-- ("P2-A Migration B2: live-table index created concurrently"). Same
-- lock_timeout/statement_timeout pattern, same non-transactional shape.
--
-- This file intentionally does NOT match
-- prisma/canonical/migrations/20260819_000001_p2c_ai_interaction_dedupekey_unique/migration.sql
-- byte-for-byte (that file uses plain, transactional CREATE UNIQUE INDEX,
-- already applied to staging and checksummed there). PostgreSQL forbids
-- CREATE INDEX CONCURRENTLY inside a transaction block, and Prisma's own
-- migration ledger only records a migration NAME + FILE CHECKSUM as
-- "applied" -- it does not re-verify the literal DDL that produced that
-- end state. Every P2-A/P2-B/P2-C migration in this repository is already
-- applied this way (a hand-written script reaching the same schema state
-- as the canonical file, checksummed against the unchanged file, not
-- executed verbatim) -- see scripts/p2c-staging-apply-dedupekey-unique-migration.ts
-- for the staging precedent of this exact pattern. This file is that
-- production-specific equivalent for the one migration in this chain that
-- cannot safely use the staging script's plain, transactional form.
--
-- Run via scripts/p2a-production-psql.ps1 -File this-path -UrlVariable DATABASE_URL
-- ONLY after scripts/p2c-production-dedupekey-preflight.sql has confirmed
-- zero duplicate non-null dedupeKey rows. Idempotent: IF EXISTS / IF NOT
-- EXISTS on both statements, safe to re-run.

SET lock_timeout = '5s';
SET statement_timeout = '0';

DROP INDEX CONCURRENTLY IF EXISTS "AIInteraction_dedupeKey_idx";

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  "AIInteraction_dedupeKey_key"
ON "AIInteraction"("dedupeKey");

RESET statement_timeout;
RESET lock_timeout;
