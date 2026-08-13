\pset pager off
\set ON_ERROR_STOP on

SET lock_timeout = '5s';
SET statement_timeout = '5min';

BEGIN;
LOCK TABLE public._prisma_migrations IN ACCESS EXCLUSIVE MODE NOWAIT;

DO $$
DECLARE
  ledger_rows integer;
  distinct_names integer;
  active_rows integer;
  rolled_back_rows integer;
  unfinished_rows integer;
BEGIN
  IF to_regclass('p2a_legacy_migration_history._prisma_migrations') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy migration archive already exists';
  END IF;

  SELECT
    count(*),
    count(DISTINCT migration_name),
    count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
    count(*) FILTER (WHERE rolled_back_at IS NOT NULL),
    count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)
  INTO ledger_rows, distinct_names, active_rows, rolled_back_rows, unfinished_rows
  FROM public._prisma_migrations;

  IF ledger_rows <> 162 OR distinct_names <> 146 OR active_rows <> 146 OR
     rolled_back_rows <> 16 OR unfinished_rows <> 0 THEN
    RAISE EXCEPTION
      'unexpected legacy ledger state rows=% names=% active=% rolled_back=% unfinished=%',
      ledger_rows, distinct_names, active_rows, rolled_back_rows, unfinished_rows;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public._prisma_migrations
    WHERE migration_name LIKE '20260810_00000%_p2a_%'
  ) THEN
    RAISE EXCEPTION 'P2-A migration rows already exist in legacy ledger';
  END IF;
END
$$;

CREATE SCHEMA p2a_legacy_migration_history;
REVOKE ALL ON SCHEMA p2a_legacy_migration_history FROM PUBLIC;

DO $$
DECLARE
  client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA p2a_legacy_migration_history FROM %I', client_role);
    END IF;
  END LOOP;
END
$$;

ALTER TABLE public._prisma_migrations
  SET SCHEMA p2a_legacy_migration_history;

REVOKE ALL ON TABLE p2a_legacy_migration_history._prisma_migrations FROM PUBLIC;

DO $$
DECLARE
  client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE p2a_legacy_migration_history._prisma_migrations FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END
$$;

COMMENT ON SCHEMA p2a_legacy_migration_history IS
  'Immutable audit archive of the pre-canonical production Prisma ledger, cut over for P2-A on 2026-08-13.';
COMMENT ON TABLE p2a_legacy_migration_history._prisma_migrations IS
  'Legacy production ledger preserved byte-for-byte at the canonical migration-root cutover.';

COMMIT;

RESET statement_timeout;
RESET lock_timeout;
