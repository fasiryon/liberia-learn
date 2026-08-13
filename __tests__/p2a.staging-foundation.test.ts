import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  assertSupabaseMigrationTransport,
  assertStagingDatabaseIsolation,
  parseSupabaseDatabaseTarget,
  parseSupabaseProjectUrl,
} from "@/lib/database-target";
import {
  APPROVED_CANONICAL_MIGRATIONS,
  APPROVED_MIGRATIONS,
  APPROVED_STAGING_SUPABASE_PROJECT_REF,
  POSTGRES_CLIENT_IMAGE,
  REQUIRED_POSTGRES_CLIENT_MAJOR,
  assertPostgresClientVersions,
} from "@/scripts/p2a-staging-preflight";

const stagingRef = "stagingref1234567890";
const directUrl = `postgresql://postgres:secret@db.${stagingRef}.supabase.co:5432/postgres?sslmode=require`;
const runtimeUrl = `postgresql://postgres.${stagingRef}:secret@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`;
const sessionUrl = `postgresql://postgres.${stagingRef}:secret@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require`;

describe("P2-A staging database identity", () => {
  it("retains a distinct post-migration preflight mode", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts", "p2a-staging-preflight.ts"),
      "utf8",
    );
    expect(source).toContain('process.argv.includes("--post-migration")');
    expect(source).toContain("14|1|1|1|10|12|10|0");
    expect(source).toContain("B2 applied/rolled-back incident records: 1|1");
  });

  it("extracts the staging project from direct and pooled URLs", () => {
    expect(parseSupabaseDatabaseTarget(directUrl)).toMatchObject({
      projectRef: stagingRef,
      port: 5432,
      mode: "direct",
      database: "postgres",
    });
    expect(parseSupabaseDatabaseTarget(runtimeUrl)).toMatchObject({
      projectRef: stagingRef,
      port: 6543,
      mode: "transaction-pooler",
      database: "postgres",
    });
    expect(parseSupabaseProjectUrl(`https://${stagingRef}.supabase.co`)).toBe(stagingRef);
  });

  it("accepts an isolated staging topology", () => {
    expect(() =>
      assertStagingDatabaseIsolation({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        STAGING_SUPABASE_PROJECT_REF: stagingRef,
        DATABASE_URL: runtimeUrl,
        DIRECT_URL: directUrl,
        SUPABASE_URL: `https://${stagingRef}.supabase.co`,
        NEXT_PUBLIC_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
      })
    ).not.toThrow();
  });

  it("accepts the guarded port-5432 session-mode migration fallback", () => {
    expect(assertSupabaseMigrationTransport(directUrl, stagingRef)).toMatchObject({
      mode: "direct",
      port: 5432,
      projectRef: stagingRef,
    });
    expect(assertSupabaseMigrationTransport(sessionUrl, stagingRef)).toMatchObject({
      mode: "session-pooler",
      port: 5432,
      projectRef: stagingRef,
    });
  });

  it("rejects transaction mode for migration transport", () => {
    expect(() => assertSupabaseMigrationTransport(runtimeUrl, stagingRef)).toThrow(
      /transaction mode is prohibited/
    );
  });

  it("rejects migration project mismatch and production identity", () => {
    expect(() => assertSupabaseMigrationTransport(sessionUrl, "differentref123456789")).toThrow(
      /does not match the approved staging project/
    );
    const productionSession = `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_REF}:secret@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require`;
    expect(() =>
      assertSupabaseMigrationTransport(productionSession, PRODUCTION_SUPABASE_PROJECT_REF)
    ).toThrow(/expected project matches production/);
  });

  it("rejects incorrect pooler routing and missing migration SSL", () => {
    const wrongRouting = `postgresql://wrong.${stagingRef}:secret@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require`;
    expect(() => assertSupabaseMigrationTransport(wrongRouting, stagingRef)).toThrow(
      /must route as postgres\.<project-ref>/
    );
    expect(() =>
      assertSupabaseMigrationTransport(sessionUrl.replace("?sslmode=require", ""), stagingRef)
    ).toThrow(/must include sslmode=require/);
  });

  it("rejects the known production project in staging", () => {
    const productionDirect = `postgresql://postgres:secret@db.${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`;
    const productionRuntime = `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_REF}:secret@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`;
    expect(() =>
      assertStagingDatabaseIsolation({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        STAGING_SUPABASE_PROJECT_REF: PRODUCTION_SUPABASE_PROJECT_REF,
        DATABASE_URL: productionRuntime,
        DIRECT_URL: productionDirect,
      })
    ).toThrow(/matches production/);
  });

  it("rejects transaction pooling used as staging DIRECT_URL", () => {
    expect(() =>
      assertStagingDatabaseIsolation({
        NODE_ENV: "production",
        VERCEL_ENV: "staging",
        STAGING_SUPABASE_PROJECT_REF: stagingRef,
        DATABASE_URL: runtimeUrl,
        DIRECT_URL: runtimeUrl,
      })
    ).toThrow(/transaction mode is prohibited/);
  });

  it("does not require migration credentials in the deployed application", () => {
    expect(() =>
      assertStagingDatabaseIsolation({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        STAGING_SUPABASE_PROJECT_REF: stagingRef,
        DATABASE_URL: runtimeUrl,
      })
    ).not.toThrow();
  });
});

describe("P2-A staging foundation artifacts", () => {
  it("pins the founder-approved staging project independently from production", () => {
    expect(APPROVED_STAGING_SUPABASE_PROJECT_REF).toBe("yonpfzjczoffhrgibxkz");
    expect(APPROVED_STAGING_SUPABASE_PROJECT_REF).not.toBe(PRODUCTION_SUPABASE_PROJECT_REF);
  });

  it("requires PostgreSQL 17 psql, pg_dump, and pg_restore clients", () => {
    expect(POSTGRES_CLIENT_IMAGE).toBe("postgres:17-alpine");
    expect(REQUIRED_POSTGRES_CLIENT_MAJOR).toBe(17);
    expect(() =>
      assertPostgresClientVersions({
        psql: "psql (PostgreSQL) 17.6",
        pgDump: "pg_dump (PostgreSQL) 17.6",
        pgRestore: "pg_restore (PostgreSQL) 17.6",
      })
    ).not.toThrow();
  });

  it("rejects an incompatible PostgreSQL client major version", () => {
    expect(() =>
      assertPostgresClientVersions({
        psql: "psql (PostgreSQL) 17.6",
        pgDump: "pg_dump (PostgreSQL) 16.14",
        pgRestore: "pg_restore (PostgreSQL) 17.6",
      })
    ).toThrow(/pgDump major version 16 is incompatible; required 17/);
  });

  it("pins all four reviewed migration hashes", () => {
    expect(APPROVED_MIGRATIONS).toHaveLength(4);
    for (const migration of APPROVED_MIGRATIONS) {
      expect(migration.sha256).toMatch(/^[A-F0-9]{64}$/);
      const sql = readFileSync(
        resolve("prisma", "migrations", migration.name, "migration.sql")
      );
      expect(sql.length).toBeGreaterThan(0);
    }
  });

  it("pins the exact two-migration canonical pre-P2-A root", () => {
    expect(APPROVED_CANONICAL_MIGRATIONS).toEqual([
      {
        name: "20260728_000003_canonical_production_state_baseline",
        sha256: "53A20E408463EB7EAD872D820C137B2C0420BF969229C776011D573ED16A73F8",
      },
      {
        name: "20260803_000001_privileged_identity_hardening",
        sha256: "1D313776B8E54CB4812425F5438CCFF4637B245CF4B74574489371FD2140B211",
      },
    ]);
  });

  it("keeps the environment template credential-free and production-free", () => {
    const template = readFileSync(resolve(".env.staging.example"), "utf8");
    expect(template).not.toContain(PRODUCTION_SUPABASE_PROJECT_REF);
    expect(template).toContain("P2A_STAGING_DATABASE_URL=");
    expect(template).toContain("STAGING_PASSWORD");
    expect(template).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it("uses only synthetic curriculum fixtures without identity data", () => {
    const fixture = readFileSync(
      resolve("prisma", "seeds", "p2a-staging-curriculum.sql"),
      "utf8"
    );
    expect(fixture.match(/p2a-staging-fixture-content-[12]/g)).toHaveLength(6);
    expect(fixture).not.toMatch(/INSERT\s+INTO\s+public\."(?:User|Student|Guardian)"/i);
    expect(fixture).toContain("ON CONFLICT");
  });

  it("passes database secrets to the Docker client by variable name", () => {
    const wrapper = readFileSync(resolve("scripts", "p2a-psql.ps1"), "utf8");
    expect(wrapper).toContain('postgres:17-alpine');
    expect(wrapper).not.toContain('postgres:16-alpine');
    expect(wrapper).toContain('PGPASSWORD = [Uri]::UnescapeDataString($userInfo[1])');
    expect(wrapper).toContain('$dockerArgs += @("-e", $name)');
    expect(wrapper).toContain('[Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name])');
    expect(wrapper).not.toContain('"PGPASSWORD=$');
    expect(wrapper).not.toContain("docker @dockerArgs $urlValue");
  });

  it("keeps backup and restore tooling on the approved PG17 boundary", () => {
    const backupRestore = readFileSync(
      resolve("scripts", "p2a-staging-backup-restore.ps1"),
      "utf8"
    );
    expect(backupRestore).toContain("yonpfzjczoffhrgibxkz");
    expect(backupRestore).toContain("bnphuinpvgpmebcsvmsp");
    expect(backupRestore).toContain("postgres:17-alpine");
    expect(backupRestore).toContain("pgvector/pgvector:0.8.0-pg17");
    expect(backupRestore).not.toContain("postgres:16-alpine");
    expect(backupRestore).toContain("--schema=public");
    expect(backupRestore).toContain("DROP SCHEMA public CASCADE");
    expect(backupRestore).toContain("CREATE EXTENSION vector WITH SCHEMA public");
    expect(backupRestore).toContain("--use-list=/tmp/p2a-restore.list");
    expect(backupRestore).toContain("p2a-staging-restore-verify.sql");
    expect(backupRestore).toContain("[Text.UTF8Encoding]::new($false)");
    const restoreVerification = readFileSync(
      resolve("scripts", "p2a-staging-restore-verify.sql"),
      "utf8"
    );
    expect(restoreVerification).toContain('public."CurriculumContent"');
    expect(restoreVerification).toContain("20260803_000001_privileged_identity_hardening");
    expect(backupRestore).toContain("20260803_000001_privileged_identity_hardening");
    expect(backupRestore).toContain("20260728_000003_canonical_production_state_baseline");
    expect(backupRestore).toContain('$expectedMigrationCount = $canonicalMigrations.Count');
    expect(backupRestore).toContain("Disposable PostgreSQL 17 restore: PASS");
    expect(backupRestore).toContain("artifactSha256");
    expect(backupRestore).toContain('migrationTransport = $migrationTransport');
    expect(backupRestore).toContain("P2A_DIRECT_ENDPOINT_UNREACHABLE");
    expect(backupRestore).toContain("SSL connection \\(protocol: TLS");
  });

  it("keeps clean-replay bypasses explicit and disposable", () => {
    const diagnostic = readFileSync(
      resolve("scripts", "diagnose-pre-p2a-clean-replay.ps1"),
      "utf8"
    );
    expect(diagnostic).toContain("postgres:17-alpine");
    expect(diagnostic).toContain("20260803_000001_privileged_identity_hardening");
    expect(diagnostic).toContain("Assert-DisposablePath");
    expect(diagnostic).toContain("DIAGNOSTIC_BYPASS");
    expect(diagnostic).toContain("DIAGNOSTIC BYPASS ONLY");
    expect(diagnostic).not.toContain("bnphuinpvgpmebcsvmsp");
    expect(diagnostic).not.toContain("yonpfzjczoffhrgibxkz");
  });

  it("documents every Gate 0 fail-closed input", () => {
    const guard = readFileSync(resolve("scripts", "p2a-staging-preflight.ts"), "utf8");
    for (const requirement of [
      "P2A_STAGING_PROJECT_REF",
      "P2A_STAGING_DATABASE_URL",
      "P2A_STAGING_DEPLOYMENT_ENV_FILE",
      "P2A_BACKUP_EVIDENCE_PATH",
      "P2A_PROVENANCE_WRITERS_DISABLED",
      "PRODUCTION_SUPABASE_PROJECT_REF",
      "pg_stat_activity",
      "\\conninfo",
      "CurriculumProvenance",
    ]) {
      expect(guard).toContain(requirement);
    }
    expect(guard).toContain('replace(/^\\uFEFF/, "")');
  });
});
