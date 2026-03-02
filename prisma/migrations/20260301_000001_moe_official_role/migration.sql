-- Block 28: Add MOE_OFFICIAL to Role enum
-- PostgreSQL 12+ allows ALTER TYPE ADD VALUE outside of a transaction block.
-- Using IF NOT EXISTS guard for idempotent re-runs.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MOE_OFFICIAL';
