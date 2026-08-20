-- Local disposable PostgreSQL fixture only.
-- Simulates successful Prisma bookkeeping after the migration SQL is applied.
INSERT INTO "_prisma_migrations" (
  "id",
  "checksum",
  "finished_at",
  "migration_name",
  "started_at",
  "applied_steps_count"
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    repeat('0', 64),
    CURRENT_TIMESTAMP,
    '20260810_000001_p2a_curriculum_provenance_core',
    CURRENT_TIMESTAMP,
    1
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    repeat('0', 64),
    CURRENT_TIMESTAMP,
    '20260810_000002_p2a_ai_generation_correlation',
    CURRENT_TIMESTAMP,
    1
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    repeat('0', 64),
    CURRENT_TIMESTAMP,
    '20260810_000003_p2a_ai_generation_correlation_index',
    CURRENT_TIMESTAMP,
    1
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    repeat('0', 64),
    CURRENT_TIMESTAMP,
    '20260810_000004_p2a_curriculum_provenance_immutability',
    CURRENT_TIMESTAMP,
    1
  );
