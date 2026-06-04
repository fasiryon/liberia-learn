-- Add ENGLISH to the Subject enum.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in Postgres,
-- so this migration must be executed standalone (not inside BEGIN/COMMIT).
ALTER TYPE "Subject" ADD VALUE 'ENGLISH';
