import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  assertSupabaseMigrationTransport,
  parseSupabaseDatabaseTarget,
  parseSupabaseProjectUrl,
  type SanitizedDatabaseTarget,
} from "../lib/database-target";

const APPROVED_BRANCH = "codex/p2a-provenance-step1";
const APPROVED_FOUNDATION_ANCESTOR = "ca60392336a4ec2064b2a176984e712cd4282257";
export const APPROVED_STAGING_SUPABASE_PROJECT_REF = "yonpfzjczoffhrgibxkz";
export const POSTGRES_CLIENT_IMAGE = "postgres:17-alpine";
export const REQUIRED_POSTGRES_CLIENT_MAJOR = 17;

export const APPROVED_CANONICAL_MIGRATIONS = [
  {
    name: "20260728_000003_canonical_production_state_baseline",
    sha256: "53A20E408463EB7EAD872D820C137B2C0420BF969229C776011D573ED16A73F8",
  },
  {
    name: "20260803_000001_privileged_identity_hardening",
    sha256: "1D313776B8E54CB4812425F5438CCFF4637B245CF4B74574489371FD2140B211",
  },
] as const;

export const APPROVED_MIGRATIONS = [
  {
    name: "20260810_000001_p2a_curriculum_provenance_core",
    sha256: "D4AB65C9D577A75C1B37D96525971B928EF985926D9AF9CFBA21B5C0DF48C7F7",
  },
  {
    name: "20260810_000002_p2a_ai_generation_correlation",
    sha256: "48C3C49F0F32026D815EC4135D886DE7B7A3D10A80E0CCDDBB3100162C6C7AB7",
  },
  {
    name: "20260810_000003_p2a_ai_generation_correlation_index",
    sha256: "234B635D51D628A46C24F140C5EF186DB045986FD21594EEE63F6029F4427AE6",
  },
  {
    name: "20260810_000004_p2a_curriculum_provenance_immutability",
    sha256: "90BE560EB65FB6B5EFBB1AFE15599BB475CD05E38119A21B2808693C0B844097",
  },
] as const;

type BackupEvidence = {
  environment: string;
  projectRef: string;
  database: string;
  databaseHost: string;
  migrationTransport: "direct" | "session-pooler";
  createdAtUtc: string;
  retentionUntilUtc: string;
  method: "supabase-daily-backup" | "supabase-pitr" | "logical-pg-dump";
  owner: string;
  evidenceLocation: string;
  restoreTestStatus: "passed";
  restoreTestedAtUtc: string;
  artifactPath?: string;
  artifactSha256?: string;
  serverVersion: string;
  psqlVersion: string;
  pgDumpVersion: string;
  pgRestoreVersion: string;
  expectedMigrationBoundary: string;
  expectedMigrationCount: number;
  migrationLedger: string[];
  syntheticFixtureCount: number;
  p2aMigrationCount: number;
  provenanceTableCount: number;
};

type Topology = {
  projectRef: string;
  migration: SanitizedDatabaseTarget;
  runtime: SanitizedDatabaseTarget;
  appUrl: string;
  backupEvidencePath: string;
  deploymentEnvPath: string;
};

type EnvironmentValues = Record<string, string | undefined>;

function fail(message: string): never {
  throw new Error(`P2-A staging preflight STOP: ${message}`);
}

function requiredEnv(name: string, env: EnvironmentValues): string {
  const value = env[name]?.trim();
  if (!value) fail(`${name} is missing`);
  return value;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function git(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    fail(`git ${args.join(" ")} failed`);
  }
  return (result.stdout ?? "").trim();
}

export function parseEnvFile(path: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = (match[2] ?? "").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[match[1]] = value;
  }
  return parsed;
}

function assertDeploymentEnv(path: string, projectRef: string): void {
  if (!existsSync(path)) fail("P2A_STAGING_DEPLOYMENT_ENV_FILE does not exist");
  const deployed = parseEnvFile(path);
  const runtime = parseSupabaseDatabaseTarget(
    requiredEnv("DATABASE_URL", deployed),
    "deployed DATABASE_URL"
  );
  const declaredRef = requiredEnv("STAGING_SUPABASE_PROJECT_REF", deployed).toLowerCase();

  if (declaredRef !== projectRef || runtime.projectRef !== projectRef) {
    fail("deployed staging environment selects a different project identifier");
  }
  if (runtime.mode !== "transaction-pooler" || runtime.port !== 6543) {
    fail("deployed DATABASE_URL is not the staging transaction pooler on port 6543");
  }
  if (new URL(deployed.DATABASE_URL).searchParams.get("sslmode") !== "require") {
    fail("deployed staging DATABASE_URL must include sslmode=require");
  }
  if (deployed.DIRECT_URL || deployed.P2A_STAGING_DATABASE_URL) {
    fail("migration-only database URLs must not be deployed to the staging application");
  }
  if (deployed.SUPABASE_URL) {
    if (parseSupabaseProjectUrl(deployed.SUPABASE_URL, "deployed SUPABASE_URL") !== projectRef) {
      fail("deployed SUPABASE_URL selects a different project identifier");
    }
  }
  if (deployed.NEXT_PUBLIC_SUPABASE_URL) {
    if (
      parseSupabaseProjectUrl(
        deployed.NEXT_PUBLIC_SUPABASE_URL,
        "deployed NEXT_PUBLIC_SUPABASE_URL"
      ) !== projectRef
    ) {
      fail("deployed NEXT_PUBLIC_SUPABASE_URL selects a different project identifier");
    }
  }
}

function assertBackupEvidence(path: string, projectRef: string, migration: SanitizedDatabaseTarget): void {
  if (!existsSync(path)) fail("P2A_BACKUP_EVIDENCE_PATH does not exist");
  let evidence: BackupEvidence;
  try {
    evidence = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as BackupEvidence;
  } catch {
    fail("backup evidence is not valid JSON");
  }

  if (evidence.environment !== "staging") fail("backup evidence is not labeled staging");
  if (evidence.projectRef.toLowerCase() !== projectRef) fail("backup evidence project differs from staging");
  if (evidence.database !== migration.database) fail("backup evidence database differs from staging");
  if (evidence.databaseHost !== migration.host) {
    fail("backup evidence host differs from staging");
  }
  if (evidence.migrationTransport !== migration.mode) {
    fail("backup evidence migration transport differs from staging");
  }
  if (!evidence.owner?.trim() || !evidence.evidenceLocation?.trim()) {
    fail("backup evidence owner or evidence location is missing");
  }
  if (evidence.restoreTestStatus !== "passed" || !evidence.restoreTestedAtUtc) {
    fail("backup evidence does not include a passed restore test");
  }
  assertPostgresClientVersions({
    psql: evidence.psqlVersion,
    pgDump: evidence.pgDumpVersion,
    pgRestore: evidence.pgRestoreVersion,
  });
  if (!/^17\./.test(evidence.serverVersion)) fail("backup source server is not PostgreSQL 17");
  if (evidence.expectedMigrationBoundary !== APPROVED_CANONICAL_MIGRATIONS[1].name) {
    fail("backup evidence has the wrong pre-P2-A migration boundary");
  }
  if (
    evidence.expectedMigrationCount !== APPROVED_CANONICAL_MIGRATIONS.length ||
    evidence.migrationLedger?.join(",") !==
      APPROVED_CANONICAL_MIGRATIONS.map((item) => item.name).join(",") ||
    evidence.syntheticFixtureCount !== 2 ||
    evidence.p2aMigrationCount !== 0 ||
    evidence.provenanceTableCount !== 0
  ) {
    fail("backup restore evidence does not match the approved pre-P2-A state");
  }
  const createdAt = Date.parse(evidence.createdAtUtc);
  const retentionUntil = Date.parse(evidence.retentionUntilUtc);
  const restoreTestedAt = Date.parse(evidence.restoreTestedAtUtc);
  if (!Number.isFinite(createdAt) || !Number.isFinite(retentionUntil) || !Number.isFinite(restoreTestedAt)) {
    fail("backup evidence timestamps are invalid");
  }
  if (retentionUntil <= Date.now()) fail("backup evidence has expired");
  if (createdAt > Date.now() + 60_000) fail("backup evidence creation time is in the future");
  if (restoreTestedAt > Date.now() + 60_000) fail("backup restore-test time is in the future");

  if (evidence.method === "logical-pg-dump") {
    if (!evidence.artifactPath || !evidence.artifactSha256) {
      fail("logical backup evidence requires artifactPath and artifactSha256");
    }
    const artifactPath = resolve(evidence.artifactPath);
    if (!existsSync(artifactPath)) fail("logical backup artifact does not exist");
    if (sha256(artifactPath) !== evidence.artifactSha256.toUpperCase()) {
      fail("logical backup artifact hash differs from backup evidence");
    }
  }
}

export function validateTopology(env: EnvironmentValues = process.env): Topology {
  const projectRef = requiredEnv("P2A_STAGING_PROJECT_REF", env).toLowerCase();
  if (!/^[a-z0-9]+$/.test(projectRef)) fail("P2A_STAGING_PROJECT_REF is malformed");
  if (projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    fail("staging project identifier matches known production");
  }
  if (projectRef !== APPROVED_STAGING_SUPABASE_PROJECT_REF) {
    fail("staging project identifier does not match the founder-approved project");
  }

  const migrationUrl = requiredEnv("P2A_STAGING_DATABASE_URL", env);
  const directUrl = requiredEnv("DIRECT_URL", env);
  const runtimeUrl = requiredEnv("DATABASE_URL", env);
  if (migrationUrl !== directUrl) {
    fail("DIRECT_URL must exactly equal P2A_STAGING_DATABASE_URL in the migration session");
  }

  let migration: SanitizedDatabaseTarget;
  try {
    migration = assertSupabaseMigrationTransport(
      migrationUrl,
      projectRef,
      "P2A_STAGING_DATABASE_URL"
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const runtime = parseSupabaseDatabaseTarget(runtimeUrl, "DATABASE_URL");
  if (
    migration.mode === "session-pooler" &&
    requiredEnv("P2A_DIRECT_ENDPOINT_UNREACHABLE", env).toLowerCase() !== "true"
  ) {
    fail("session-pooler migration fallback requires P2A_DIRECT_ENDPOINT_UNREACHABLE=true");
  }
  if (runtime.mode !== "transaction-pooler" || runtime.port !== 6543) {
    fail("DATABASE_URL must use the transaction pooler on port 6543");
  }
  if (migration.projectRef !== projectRef || runtime.projectRef !== projectRef) {
    fail("runtime or migration target differs from P2A_STAGING_PROJECT_REF");
  }
  if (migration.database !== runtime.database) {
    fail("runtime and migration URLs select different databases");
  }
  if (new URL(runtimeUrl).searchParams.get("pgbouncer") !== "true") {
    fail("DATABASE_URL must include pgbouncer=true");
  }
  if (
    new URL(runtimeUrl).searchParams.get("sslmode") !== "require" ||
    new URL(migrationUrl).searchParams.get("sslmode") !== "require"
  ) {
    fail("staging database URLs must include sslmode=require");
  }

  const appUrl = requiredEnv("P2A_STAGING_APP_URL", env);
  const parsedAppUrl = new URL(appUrl);
  if (parsedAppUrl.protocol !== "https:") fail("P2A_STAGING_APP_URL must use HTTPS");

  const deploymentEnvPath = resolve(requiredEnv("P2A_STAGING_DEPLOYMENT_ENV_FILE", env));
  assertDeploymentEnv(deploymentEnvPath, projectRef);

  const backupEvidencePath = resolve(requiredEnv("P2A_BACKUP_EVIDENCE_PATH", env));
  assertBackupEvidence(backupEvidencePath, projectRef, migration);

  if (requiredEnv("P2A_PROVENANCE_WRITERS_DISABLED", env).toLowerCase() !== "true") {
    fail("P2A_PROVENANCE_WRITERS_DISABLED must be true");
  }

  return { projectRef, migration, runtime, appUrl, backupEvidencePath, deploymentEnvPath };
}

function assertRepository(): void {
  const branch = git(["branch", "--show-current"]);
  if (branch !== APPROVED_BRANCH) fail(`expected branch ${APPROVED_BRANCH}, found ${branch || "detached"}`);
  if (git(["status", "--porcelain"])) fail("Git worktree is not clean");
  const ancestor = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", APPROVED_FOUNDATION_ANCESTOR, "HEAD"],
    { encoding: "utf8" }
  );
  if (ancestor.status !== 0) fail("reviewed P2-A foundation commit is not an ancestor of HEAD");

  for (const migration of APPROVED_MIGRATIONS) {
    const path = resolve("prisma", "migrations", migration.name, "migration.sql");
    if (!existsSync(path)) fail(`reviewed migration is missing: ${migration.name}`);
    if (sha256(path) !== migration.sha256) fail(`reviewed migration hash differs: ${migration.name}`);
  }

  for (const migration of APPROVED_CANONICAL_MIGRATIONS) {
    const path = resolve("prisma", "canonical", "migrations", migration.name, "migration.sql");
    if (!existsSync(path)) fail(`canonical migration is missing: ${migration.name}`);
    if (sha256(path) !== migration.sha256) fail(`canonical migration hash differs: ${migration.name}`);
  }

  const writerScanResult = spawnSync(
    process.execPath,
    [resolve("node_modules", "tsx", "dist", "cli.mjs"), "scripts/p2a-writer-guard.ts"],
    { encoding: "utf8" },
  );
  if (writerScanResult.status !== 0) {
    const detail =
      (writerScanResult.stderr ?? "").trim() ||
      writerScanResult.error?.message ||
      `exit status ${String(writerScanResult.status)}`;
    fail(`application provenance writer guard failed: ${detail}`);
  }
}

type PostgresClientVersions = {
  psql: string;
  pgDump: string;
  pgRestore: string;
};

function postgresMajor(versionOutput: string, tool: string): number {
  const match = versionOutput.match(/\(PostgreSQL\)\s+(\d+)(?:\.|\s|$)/i);
  if (!match) fail(`${tool} returned an unrecognized version string`);
  return Number.parseInt(match[1], 10);
}

export function assertPostgresClientVersions(versions: PostgresClientVersions): void {
  for (const [tool, output] of Object.entries(versions)) {
    const major = postgresMajor(output, tool);
    if (major !== REQUIRED_POSTGRES_CLIENT_MAJOR) {
      fail(`${tool} major version ${major} is incompatible; required ${REQUIRED_POSTGRES_CLIENT_MAJOR}`);
    }
  }
}

function assertClientTooling(): PostgresClientVersions {
  const docker = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
  });
  if (docker.status !== 0) fail("Docker is unavailable for the pinned PostgreSQL client");
  const image = spawnSync("docker", ["image", "inspect", POSTGRES_CLIENT_IMAGE], {
    encoding: "utf8",
  });
  if (image.status !== 0) {
    fail(`${POSTGRES_CLIENT_IMAGE} is not present locally; provision it before Gate 0`);
  }
  const commands = {
    psql: ["psql", "--version"],
    pgDump: ["pg_dump", "--version"],
    pgRestore: ["pg_restore", "--version"],
  } as const;
  const versions = {} as PostgresClientVersions;
  for (const [tool, command] of Object.entries(commands)) {
    const result = spawnSync("docker", ["run", "--rm", POSTGRES_CLIENT_IMAGE, ...command], {
      encoding: "utf8",
    });
    if (result.status !== 0) fail(`${tool} is unavailable in ${POSTGRES_CLIENT_IMAGE}`);
    versions[tool as keyof PostgresClientVersions] = (result.stdout ?? "").trim();
  }
  assertPostgresClientVersions(versions);
  return versions;
}

function runPsql(envName: "P2A_STAGING_DATABASE_URL" | "DATABASE_URL", sql: string): string {
  const rawUrl = process.env[envName];
  if (!rawUrl) fail(`${envName} is missing`);
  const parsed = new URL(rawUrl);
  const userInfo = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  const clientEnv = {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: userInfo,
    PGPASSWORD: password,
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    PGSSLMODE: "require",
  };
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-i",
      "-e", "PGHOST",
      "-e", "PGPORT",
      "-e", "PGUSER",
      "-e", "PGPASSWORD",
      "-e", "PGDATABASE",
      "-e", "PGSSLMODE",
      POSTGRES_CLIENT_IMAGE,
      "psql",
      "-X",
      "-v", "ON_ERROR_STOP=1",
      "-At",
      "-q",
      "-F", "|",
      "-c",
      sql,
    ],
    { encoding: "utf8", env: clientEnv }
  );
  if (result.status !== 0) fail(`${envName} connectivity or SQL assertion failed`);
  return (result.stdout ?? "").trim();
}

async function assertLiveEnvironment(topology: Topology, postMigration: boolean): Promise<void> {
  const identitySql = `
    SELECT current_database(), current_user, COALESCE(inet_server_addr()::text, 'local'),
           current_setting('server_version'),
           COALESCE((SELECT ssl::text FROM pg_stat_ssl WHERE pid = pg_backend_pid()), 'false');
  `;
  const migrationIdentity = runPsql("P2A_STAGING_DATABASE_URL", identitySql);
  const runtimeIdentity = runPsql("DATABASE_URL", identitySql);
  const migrationConninfo = runPsql("P2A_STAGING_DATABASE_URL", "\\conninfo");
  const runtimeConninfo = runPsql("DATABASE_URL", "\\conninfo");
  const migrationParts = migrationIdentity.split("|");
  const runtimeParts = runtimeIdentity.split("|");
  const migrationDatabase = migrationParts[0];
  const runtimeDatabase = runtimeParts[0];
  if (migrationDatabase !== topology.migration.database || runtimeDatabase !== topology.runtime.database) {
    fail("live database identity differs from the sanitized URL target");
  }
  if (!/SSL connection \(protocol: TLS/i.test(migrationConninfo)) {
    fail("migration database client connection is not using SSL");
  }
  if (!/SSL connection \(protocol: TLS/i.test(runtimeConninfo)) {
    fail("runtime database client connection is not using SSL");
  }

  if (topology.migration.mode === "session-pooler") {
    const sessionProbe = runPsql(
      "P2A_STAGING_DATABASE_URL",
      `BEGIN;
       CREATE TEMP TABLE p2a_session_transport_probe(value integer) ON COMMIT PRESERVE ROWS;
       INSERT INTO p2a_session_transport_probe VALUES (1);
       COMMIT;
       SELECT count(*) FROM p2a_session_transport_probe;
       DROP TABLE p2a_session_transport_probe;`
    );
    if (sessionProbe.split(/\r?\n/).at(-1) !== "1") {
      fail("Supavisor session-mode persistence probe failed");
    }
  }

  const unfinishedMigrations = runPsql(
    "P2A_STAGING_DATABASE_URL",
    `SELECT count(*) FROM public."_prisma_migrations"
     WHERE finished_at IS NULL AND rolled_back_at IS NULL;`
  );
  if (unfinishedMigrations !== "0") fail("staging has unfinished Prisma migrations");

  const activeMigrationState = runPsql(
    "P2A_STAGING_DATABASE_URL",
    `SELECT COALESCE(string_agg(migration_name, ',' ORDER BY migration_name), '')
     FROM public."_prisma_migrations"
     WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;`
  );
  const expectedActiveMigrations = [
    ...APPROVED_CANONICAL_MIGRATIONS,
    ...(postMigration ? APPROVED_MIGRATIONS : []),
  ].map((item) => item.name).sort().join(",");
  if (activeMigrationState !== expectedActiveMigrations) {
    fail(
      postMigration
        ? "staging Prisma ledger is not the exact approved canonical plus P2-A state"
        : "staging Prisma ledger is not the exact approved canonical pre-P2-A state",
    );
  }

  const p2aState = runPsql(
    "P2A_STAGING_DATABASE_URL",
    `SELECT count(*) FROM public."_prisma_migrations"
     WHERE migration_name IN (${APPROVED_MIGRATIONS.map((item) => `'${item.name}'`).join(",")})
       AND finished_at IS NOT NULL AND rolled_back_at IS NULL;`
  );
  if (p2aState !== (postMigration ? String(APPROVED_MIGRATIONS.length) : "0")) {
    fail(postMigration ? "not all approved P2-A migrations are active" : "one or more P2-A migrations are already recorded on staging");
  }

  const relationState = runPsql(
    "P2A_STAGING_DATABASE_URL",
    `SELECT count(*) FROM (VALUES
       (to_regclass('public."CurriculumProvenance"')),
       (to_regclass('public."CurriculumContentRevision"')),
       (to_regclass('public."CurriculumGovernanceEvent"')),
       (to_regclass('public."CurriculumEvidence"'))
     ) AS relations(relation_name) WHERE relation_name IS NOT NULL;`
  );
  if (relationState !== (postMigration ? "4" : "0")) {
    fail(postMigration ? "P2-A provenance table set is incomplete" : "P2-A provenance tables unexpectedly exist before Migration A");
  }

  if (postMigration) {
    const finalSchemaState = runPsql(
      "P2A_STAGING_DATABASE_URL",
      `SELECT
         (SELECT count(*) FROM pg_type WHERE typname IN (
           'CurriculumProvenanceCompleteness', 'CurriculumLifecycleState',
           'CurriculumRevisionKind', 'CurriculumOriginKind',
           'CurriculumGovernanceEventType', 'CurriculumGovernanceActorType',
           'CurriculumApprovalBasis', 'CurriculumReviewAuthority',
           'CurriculumFutureAssignmentPolicy', 'CurriculumExistingAssignmentPolicy',
           'CurriculumOfflineCachePolicy', 'CurriculumEvidenceType',
           'CurriculumEvidencePurpose', 'CurriculumEvidenceStatus')),
         (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'CurriculumGovernanceEvent'
            AND column_name = 'riskReasons' AND is_nullable = 'NO'
            AND column_default ILIKE '%ARRAY[]%'),
         (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'AIInteraction'
            AND column_name = 'generationCorrelationId' AND is_nullable = 'YES'
            AND column_default IS NULL),
         (SELECT count(*) FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = 'AIInteraction_generationCorrelationId_createdAt_idx'
            AND i.indisready AND i.indisvalid),
         (SELECT count(*) FROM pg_trigger
          WHERE tgname IN (
            'curriculum_content_revision_no_update_or_delete',
            'curriculum_governance_event_no_update_or_delete',
            'curriculum_evidence_no_update_or_delete',
            'curriculum_content_revision_no_truncate',
            'curriculum_governance_event_no_truncate',
            'curriculum_evidence_no_truncate',
            'curriculum_provenance_no_delete',
            'curriculum_provenance_no_truncate',
            'curriculum_provenance_identity_no_update',
            'curriculum_provenance_current_revision_guard')
            AND tgenabled = 'O'),
         (SELECT count(*) FROM pg_constraint
          WHERE contype = 'f' AND convalidated
            AND conrelid IN (
              'public."CurriculumProvenance"'::regclass,
              'public."CurriculumContentRevision"'::regclass,
              'public."CurriculumGovernanceEvent"'::regclass,
              'public."CurriculumEvidence"'::regclass)),
         (SELECT count(*) FROM pg_index
          WHERE indisunique AND indisvalid AND NOT indisprimary
            AND indrelid IN (
              'public."CurriculumProvenance"'::regclass,
              'public."CurriculumContentRevision"'::regclass,
              'public."CurriculumGovernanceEvent"'::regclass,
              'public."CurriculumEvidence"'::regclass)),
         (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'CurriculumContent'
            AND column_name = 'provenance');`
    );
    if (finalSchemaState !== "14|1|1|1|10|12|10|0") {
      fail(`post-migration schema invariants differ: ${finalSchemaState}`);
    }
    const b2IncidentState = runPsql(
      "P2A_STAGING_DATABASE_URL",
      `SELECT
         count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
         count(*) FILTER (WHERE rolled_back_at IS NOT NULL)
       FROM public."_prisma_migrations"
       WHERE migration_name = '20260810_000003_p2a_ai_generation_correlation_index';`,
    );
    if (b2IncidentState !== "1|1") {
      fail(`B2 applied/rolled-back incident history differs: ${b2IncidentState}`);
    }
  }

  const fixtureCount = runPsql(
    "P2A_STAGING_DATABASE_URL",
    `SELECT count(*) FROM public."CurriculumContent"
     WHERE "contentId" IN ('p2a-staging-fixture-content-1', 'p2a-staging-fixture-content-2');`
  );
  if (fixtureCount !== "2") fail("the two synthetic P2-A curriculum fixtures are not present");

  const oldTransactions = runPsql(
    "P2A_STAGING_DATABASE_URL",
    `SELECT count(*) FROM pg_stat_activity
     WHERE datname = current_database()
       AND pid <> pg_backend_pid()
       AND xact_start IS NOT NULL
       AND now() - xact_start > interval '15 minutes';`
  );
  if (oldTransactions !== "0") fail("unexplained transactions older than 15 minutes require owner review");

  const response = await fetch(new URL("/api/health", topology.appUrl), {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) fail(`staging application health returned HTTP ${response.status}`);
  const health = (await response.json()) as { checks?: { database?: string } };
  if (health.checks?.database !== "ok") fail("staging application database health is not ok");

  console.log(`Migration database identity: ${migrationIdentity}`);
  console.log(`Migration transport mode: ${topology.migration.mode}`);
  console.log("Migration client TLS: PASS");
  console.log("Runtime client TLS: PASS");
  console.log(`Runtime database identity: ${runtimeIdentity}`);
  console.log(`Active P2-A migration rows: ${postMigration ? APPROVED_MIGRATIONS.length : 0}`);
  console.log("Unfinished Prisma migration rows: 0");
  console.log(`Canonical pre-P2-A migration rows: ${APPROVED_CANONICAL_MIGRATIONS.length}`);
  console.log(`P2-A provenance tables: ${postMigration ? 4 : 0}`);
  if (postMigration) {
    console.log("Post-migration schema invariants: 14|1|1|1|10|12|10|0");
    console.log("B2 applied/rolled-back incident records: 1|1");
  }
  console.log("Synthetic P2-A curriculum fixtures: 2");
  console.log("Transactions older than 15 minutes: 0");
  console.log(`Staging application health: ${response.status}, database ok`);
}

export async function main(): Promise<void> {
  const staticOnly = process.argv.includes("--static-only");
  const postMigration = process.argv.includes("--post-migration");
  assertRepository();
  const topology = validateTopology();
  const clientVersions = assertClientTooling();

  console.log(`Timestamp UTC: ${new Date().toISOString()}`);
  console.log(`Git branch: ${APPROVED_BRANCH}`);
  console.log(`Git commit: ${git(["rev-parse", "HEAD"])}`);
  console.log(`Staging project: ${topology.projectRef}`);
  console.log(
    `Migration target: ${topology.migration.host}:${topology.migration.port}/${topology.migration.database}`
  );
  console.log(`Migration transport mode: ${topology.migration.mode}`);
  console.log(
    `Runtime target: ${topology.runtime.host}:${topology.runtime.port}/${topology.runtime.database}`
  );
  console.log(`PostgreSQL psql client: ${clientVersions.psql} via ${POSTGRES_CLIENT_IMAGE}`);
  console.log(`PostgreSQL pg_dump client: ${clientVersions.pgDump} via ${POSTGRES_CLIENT_IMAGE}`);
  console.log(`PostgreSQL pg_restore client: ${clientVersions.pgRestore} via ${POSTGRES_CLIENT_IMAGE}`);
  console.log(`Backup evidence: ${topology.backupEvidencePath}`);
  console.log(`Deployment environment evidence: ${topology.deploymentEnvPath}`);
  console.log("Reviewed migration hashes: PASS");
  console.log("Application provenance writer scan: PASS");

  if (staticOnly) {
    console.log("Live connectivity and application health: SKIPPED by --static-only");
    return;
  }

  await assertLiveEnvironment(topology, postMigration);
  console.log(postMigration ? "P2-A STAGING POST-MIGRATION PREFLIGHT: PASS" : "P2-A STAGING GATE 0 PREFLIGHT: PASS");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(process.cwd(), "scripts", "p2a-staging-preflight.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
