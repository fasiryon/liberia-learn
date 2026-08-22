import { PrismaClient } from "@prisma/client";
import { parseSupabaseDatabaseTarget } from "../lib/database-target";

const TABLES = [
  "CurriculumProvenance",
  "CurriculumContentRevision",
  "CurriculumEvidence",
  "CurriculumGovernanceEvent",
  "ReviewerProfile",
  "ReviewerCredential",
  "ReviewerCredentialScope",
  "ReviewerCredentialStatusEvent",
  "ReviewerRestriction",
  "CurriculumReviewTask",
  "CurriculumReviewAssignment",
  "CurriculumReviewAssessment",
  "CurriculumReviewDecision",
  "ReviewCalibrationSession",
  "ReviewCalibrationResult",
  "AIReviewAgent",
  "CurriculumAIReviewAssessment",
  "AIInteraction",
  "AiInteractionLog",
  "AuditLog",
] as const;

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const expectedProjectRef = process.argv[2]?.trim();
if (!expectedProjectRef) throw new Error("Expected Supabase project ref argument is required");
const target = parseSupabaseDatabaseTarget(databaseUrl, "DATABASE_URL");
if (target.projectRef !== expectedProjectRef) {
  throw new Error(`Database target mismatch: expected ${expectedProjectRef}, got ${target.projectRef}`);
}

const prisma = new PrismaClient();

type JsonRow = Record<string, unknown>;

function jsonSafe(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
}

async function probeBrowserRole(role: "anon" | "authenticated") {
  try {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      return tx.$queryRawUnsafe<JsonRow[]>(
        'SELECT count(*)::bigint AS visible_rows FROM public."CurriculumReviewTask"',
      );
    });
    return { role, outcome: "SELECT_ALLOWED", visibleRows: rows[0]?.visible_rows ?? null };
  } catch (error) {
    return {
      role,
      outcome: "SELECT_DENIED",
      errorCode: typeof error === "object" && error && "code" in error ? String(error.code) : null,
    };
  }
}

async function main() {
  const identity = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT current_database() AS database, current_user AS database_user,
           inet_server_addr()::text AS server_address,
           current_setting('server_version') AS server_version
  `);
  const relations = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT c.relname AS table_name,
           c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced,
           COALESCE(p.policy_count, 0)::int AS policy_count,
           COALESCE(p.policy_names, ARRAY[]::text[]) AS policy_names,
           has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'SELECT') AS anon_select,
           has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'INSERT') AS anon_insert,
           has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'UPDATE') AS anon_update,
           has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'DELETE') AS anon_delete,
           has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'SELECT') AS authenticated_select,
           has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'INSERT') AS authenticated_insert,
           has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'UPDATE') AS authenticated_update,
           has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'DELETE') AS authenticated_delete
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN (
      SELECT schemaname, tablename, count(*) AS policy_count,
             array_agg(policyname ORDER BY policyname) AS policy_names
      FROM pg_policies GROUP BY schemaname, tablename
    ) p ON p.schemaname = n.nspname AND p.tablename = c.relname
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname = ANY($1::text[])
    ORDER BY c.relname
  `, [...TABLES]);
  const counts = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT relname AS table_name, n_live_tup::bigint AS estimated_rows
    FROM pg_stat_user_tables
    WHERE schemaname = 'public' AND relname = ANY($1::text[])
    ORDER BY relname
  `, [...TABLES]);
  const migrations = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM public._prisma_migrations
    WHERE migration_name LIKE '20260810_%'
       OR migration_name LIKE '20260813_%'
       OR migration_name LIKE '20260814_%'
       OR migration_name LIKE '20260818_%'
       OR migration_name LIKE '20260819_%'
       OR migration_name LIKE '20260820_%'
    ORDER BY migration_name
  `);
  const securityDefinerCandidates = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT n.nspname AS schema_name, p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND EXISTS (
        SELECT 1 FROM unnest($1::text[]) table_name
        WHERE lower(pg_get_functiondef(p.oid)) LIKE '%' || lower(table_name) || '%'
      )
    ORDER BY n.nspname, p.proname
  `, [...TABLES]);
  const defaultPrivileges = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT pg_get_userbyid(d.defaclrole) AS owner,
           n.nspname AS schema_name,
           d.defaclobjtype AS object_type,
           d.defaclacl::text AS access_control_list
    FROM pg_default_acl d
    LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE n.nspname = 'public' OR d.defaclnamespace = 0
    ORDER BY owner, schema_name, object_type
  `);
  const p2bDatabaseObjects = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT 'index' AS object_type, indexname AS object_name, indexdef AS definition
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'CurriculumReviewAssignment_active_slot_key',
        'CurriculumReviewAssignment_active_reviewer_key'
      )
    UNION ALL
    SELECT 'trigger', t.tgname, pg_get_triggerdef(t.oid)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
      AND t.tgname IN (
        'CurriculumReviewAssessment_submitted_immutable',
        'CurriculumReviewDecision_final_immutable',
        'CurriculumReviewDecision_integrity_guard'
      )
    ORDER BY object_type, object_name
  `);
  const p2bIntegrity = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT
      (SELECT count(*) FROM (
        SELECT "taskId", slot FROM "CurriculumReviewAssignment"
        WHERE status = 'ACTIVE' GROUP BY "taskId", slot HAVING count(*) > 1
      ) d) AS duplicate_active_slots,
      (SELECT count(*) FROM (
        SELECT "taskId", "reviewerProfileId" FROM "CurriculumReviewAssignment"
        WHERE status = 'ACTIVE' GROUP BY "taskId", "reviewerProfileId" HAVING count(*) > 1
      ) d) AS duplicate_active_reviewers,
      (SELECT count(*) FROM "CurriculumReviewAssignment"
        WHERE status = 'ACTIVE' AND "leaseExpiresAt" <= now()) AS expired_still_active,
      (SELECT count(*) FROM "CurriculumReviewDecision" d
        JOIN "CurriculumReviewTask" t ON t.id = d."taskId"
        LEFT JOIN "CurriculumGovernanceEvent" g ON g.id = d."governanceEventId"
        WHERE d.status = 'FINAL' AND (
          g.id IS NULL OR g."revisionId" <> t."revisionId"
          OR g."provenanceId" <> t."provenanceId"
          OR g."auditLogId" <> d."auditLogId"
        )) AS invalid_final_compositions
  `);
  const p2bOperationalEvidence = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT 'task_status' AS category, status::text AS key, count(*)::bigint AS count
    FROM "CurriculumReviewTask" GROUP BY status
    UNION ALL
    SELECT 'assignment_status', status::text, count(*)::bigint
    FROM "CurriculumReviewAssignment" GROUP BY status
    UNION ALL
    SELECT 'assessment_status', status::text, count(*)::bigint
    FROM "CurriculumReviewAssessment" GROUP BY status
    UNION ALL
    SELECT 'decision_status', status::text, count(*)::bigint
    FROM "CurriculumReviewDecision" GROUP BY status
    UNION ALL
    SELECT 'audit_action', action, count(*)::bigint
    FROM "AuditLog"
    WHERE action IN (
      'curriculum.review.claimed',
      'curriculum.review.recused',
      'curriculum.review.claim.released',
      'curriculum.review.claim.overridden',
      'curriculum.review.assessment.submitted'
    ) GROUP BY action
    ORDER BY category, key
  `);
  const p2bLeaseEvidence = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT count(*)::bigint AS assignment_count,
           min(EXTRACT(EPOCH FROM ("leaseExpiresAt" - "claimedAt")) / 60.0) AS min_lease_minutes,
           max(EXTRACT(EPOCH FROM ("leaseExpiresAt" - "claimedAt")) / 60.0) AS max_lease_minutes,
           max(EXTRACT(EPOCH FROM ("maxContinuousUntil" - "claimedAt")) / 60.0) AS max_continuous_minutes,
           count(*) FILTER (WHERE "lastHeartbeatAt" IS NOT NULL)::bigint AS heartbeat_count,
           count(*) FILTER (WHERE status = 'RECUSED')::bigint AS recusal_count
    FROM "CurriculumReviewAssignment"
  `);
  const browserRoleSelectProbes = await Promise.all([
    probeBrowserRole("anon"),
    probeBrowserRole("authenticated"),
  ]);
  const framework = await prisma.$queryRawUnsafe<JsonRow[]>(`
    SELECT code, title, exam, "examAliases", "regionalReferenceLabels",
           "verificationStatus", "externalAuthorityStatus"
    FROM public."AssessmentBaselineFramework"
    WHERE code = 'WAEC.LIBERIA.LSHSCE.REGULAR'
  `);

  process.stdout.write(`${JSON.stringify(jsonSafe({
    target,
    identity,
    relations,
    counts,
    migrations,
    securityDefinerCandidates,
    defaultPrivileges,
    p2bDatabaseObjects,
    p2bIntegrity,
    p2bOperationalEvidence,
    p2bLeaseEvidence,
    browserRoleSelectProbes,
    framework,
  }), null, 2)}\n`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
