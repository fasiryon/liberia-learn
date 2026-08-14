import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRODUCTION_SUPABASE_PROJECT_REF, assertSupabaseMigrationTransport, parseSupabaseDatabaseTarget } from "../lib/database-target";

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const MIGRATION = "20260813_000001_p2b_qualified_review_operations";
const MIGRATION_SHA256 = "655AD60067634CAB8277CA0F2DE327B1909BADDCDB3B5C5299E76537283BA1D0";
const REQUIRED_BASE = [
  "20260728_000003_canonical_production_state_baseline",
  "20260803_000001_privileged_identity_hardening",
  "20260810_000001_p2a_curriculum_provenance_core",
  "20260810_000002_p2a_ai_generation_correlation",
  "20260810_000003_p2a_ai_generation_correlation_index",
  "20260810_000004_p2a_curriculum_provenance_immutability",
] as const;

function stop(message: string): never { throw new Error(`P2-B staging preflight STOP: ${message}`); }
function required(name: string): string { const value = process.env[name]?.trim(); if (!value) stop(`${name} is missing`); return value; }
function hash(path: string): string { return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase(); }
function git(...args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) stop(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function runSql(sql: string): string {
  const raw = required("P2A_STAGING_DATABASE_URL");
  const target = new URL(raw);
  const env = {
    ...process.env,
    PGHOST: target.hostname,
    PGPORT: target.port || "5432",
    PGUSER: decodeURIComponent(target.username),
    PGPASSWORD: decodeURIComponent(target.password),
    PGDATABASE: decodeURIComponent(target.pathname.slice(1)),
    PGSSLMODE: "require",
  };
  const result = spawnSync("docker", ["run", "--rm", "-i", "-e", "PGHOST", "-e", "PGPORT", "-e", "PGUSER", "-e", "PGPASSWORD", "-e", "PGDATABASE", "-e", "PGSSLMODE", "postgres:17-alpine", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-Atq", "-F", "|", "-c", sql], { encoding: "utf8", env });
  if (result.status !== 0) stop(`staging SQL assertion failed: ${(result.stderr || "unknown failure").trim()}`);
  return result.stdout.trim();
}

function assertStatic(): void {
  const branch = git("branch", "--show-current");
  if (branch !== "codex/p2b-qualified-review-operations") stop(`unexpected branch ${branch}`);
  if (git("merge-base", "--is-ancestor", "3d6f0668d715d95b736ba62ed60a95db1e9524ac", "HEAD") !== "") stop("unexpected ancestry response");
  const projectRef = required("P2A_STAGING_PROJECT_REF").toLowerCase();
  if (projectRef !== STAGING_REF || projectRef === PRODUCTION_SUPABASE_PROJECT_REF) stop("project ref is not approved staging");
  const migrationUrl = required("P2A_STAGING_DATABASE_URL");
  assertSupabaseMigrationTransport(migrationUrl, projectRef, "P2A_STAGING_DATABASE_URL");
  const runtime = parseSupabaseDatabaseTarget(required("DATABASE_URL"), "DATABASE_URL");
  if (runtime.projectRef !== projectRef || runtime.mode !== "transaction-pooler" || runtime.port !== 6543) stop("runtime target is not approved staging transaction pooler");
  const backupPath = resolve(required("P2A_BACKUP_EVIDENCE_PATH"));
  if (!existsSync(backupPath)) stop("backup evidence is missing");
  const backup = JSON.parse(readFileSync(backupPath, "utf8").replace(/^\uFEFF/, "")) as { environment?: string; projectRef?: string; retentionUntilUtc?: string; restoreTestStatus?: string };
  if (backup.environment !== "staging" || backup.projectRef !== STAGING_REF || backup.restoreTestStatus !== "passed" || Date.parse(backup.retentionUntilUtc ?? "") <= Date.now()) stop("backup evidence is invalid or expired");
  const path = resolve("prisma", "canonical", "migrations", MIGRATION, "migration.sql");
  if (!existsSync(path) || hash(path) !== MIGRATION_SHA256) stop("P2-B migration hash differs from reviewed local artifact");
}

async function assertLive(postMigration: boolean): Promise<void> {
  const active = runSql(`SELECT COALESCE(string_agg(migration_name, ',' ORDER BY migration_name), '') FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;`);
  const expected = [...REQUIRED_BASE, ...(postMigration ? [MIGRATION] : [])].sort().join(",");
  if (active !== expected) stop(`active migration ledger differs: ${active}`);
  if (runSql(`SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;`) !== "0") stop("unfinished migration exists");
  if (runSql(`SELECT count(*) FROM (VALUES (to_regclass('public."CurriculumProvenance"')), (to_regclass('public."CurriculumContentRevision"')), (to_regclass('public."CurriculumGovernanceEvent"')), (to_regclass('public."CurriculumEvidence"'))) v(r) WHERE r IS NOT NULL;`) !== "4") stop("P2-A canonical tables are incomplete");
  const p2bCount = runSql(`SELECT count(*) FROM (VALUES (to_regclass('public."ReviewerProfile"')), (to_regclass('public."ReviewerCredential"')), (to_regclass('public."ReviewerCredentialScope"')), (to_regclass('public."ReviewerCredentialStatusEvent"')), (to_regclass('public."ReviewerRestriction"')), (to_regclass('public."CurriculumReviewTask"')), (to_regclass('public."CurriculumReviewAssignment"')), (to_regclass('public."CurriculumReviewAssessment"')), (to_regclass('public."CurriculumReviewDecision"')), (to_regclass('public."ReviewCalibrationSession"')), (to_regclass('public."ReviewCalibrationResult"'))) v(r) WHERE r IS NOT NULL;`);
  if (p2bCount !== (postMigration ? "11" : "0")) stop(`P2-B table count differs: ${p2bCount}`);
  if (postMigration) {
    const guards = runSql(`SELECT (SELECT count(*) FROM pg_trigger WHERE tgname IN ('CurriculumReviewAssessment_submitted_immutable','CurriculumReviewDecision_final_immutable','ReviewerCredentialStatusEvent_immutable','ReviewCalibrationResult_immutable','ReviewerCredential_verified_core_immutable','ReviewerCredentialScope_verified_immutable','ReviewerCredential_verify_guard','CurriculumReviewDecision_integrity_guard') AND tgenabled = 'O'), (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('CurriculumReviewAssignment_active_slot_key','CurriculumReviewAssignment_active_reviewer_key'));`);
    if (guards !== "8|2") stop(`P2-B database guard count differs: ${guards}`);
  }
  const identity = runSql(`SELECT current_database(), current_user, current_setting('server_version'), COALESCE((SELECT ssl::text FROM pg_stat_ssl WHERE pid=pg_backend_pid()), 'false');`);
  const conninfo = runSql("\\conninfo");
  if (!/SSL connection \(protocol: TLS/i.test(conninfo)) stop("migration client connection is not using TLS");
  const health = await fetch(new URL("/api/health", required("P2A_STAGING_APP_URL")), { headers: { "cache-control": "no-cache" } });
  if (!health.ok) stop(`staging health returned ${health.status}`);
  console.log(`Staging identity: ${identity}`);
  console.log("Migration client TLS: PASS");
  console.log(`Active migration rows: ${postMigration ? 7 : 6}`);
  console.log(`P2-B tables: ${p2bCount}`);
  console.log(`Staging health: ${health.status}`);
}

async function main(): Promise<void> {
  const postMigration = process.argv.includes("--post-migration");
  assertStatic();
  console.log(`Timestamp UTC: ${new Date().toISOString()}`);
  console.log(`Branch: ${git("branch", "--show-current")}`);
  console.log(`Commit: ${git("rev-parse", "HEAD")}`);
  console.log(`Staging project: ${STAGING_REF}`);
  console.log(`P2-B migration SHA-256: ${MIGRATION_SHA256}`);
  await assertLive(postMigration);
  console.log(postMigration ? "P2-B STAGING POST-MIGRATION PREFLIGHT: PASS" : "P2-B STAGING PRE-MIGRATION PREFLIGHT: PASS");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
