-- Additive enum values are isolated so PostgreSQL commits them before the
-- following migration uses them. Existing migration bytes remain unchanged.
ALTER TYPE "CurriculumGovernanceEventType" ADD VALUE IF NOT EXISTS 'AUTHORITY_CORRECTED';
ALTER TYPE "CognitiveDemandCategory" ADD VALUE IF NOT EXISTS 'NOT_ESTABLISHED';
