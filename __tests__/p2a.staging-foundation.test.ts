import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  assertStagingDatabaseIsolation,
  parseSupabaseDatabaseTarget,
  parseSupabaseProjectUrl,
} from "@/lib/database-target";
import { APPROVED_MIGRATIONS } from "@/scripts/p2a-staging-preflight";

const stagingRef = "stagingref1234567890";
const directUrl = `postgresql://postgres:secret@db.${stagingRef}.supabase.co:5432/postgres?sslmode=require`;
const runtimeUrl = `postgresql://postgres.${stagingRef}:secret@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`;

describe("P2-A staging database identity", () => {
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

  it("rejects a pooled endpoint used as staging DIRECT_URL", () => {
    expect(() =>
      assertStagingDatabaseIsolation({
        NODE_ENV: "production",
        VERCEL_ENV: "staging",
        STAGING_SUPABASE_PROJECT_REF: stagingRef,
        DATABASE_URL: runtimeUrl,
        DIRECT_URL: runtimeUrl,
      })
    ).toThrow(/direct endpoint on port 5432/);
  });
});

describe("P2-A staging foundation artifacts", () => {
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
    expect(wrapper).toContain('"-e", $UrlVariable');
    expect(wrapper).toContain('printenv "$1"');
    expect(wrapper).not.toContain("docker @dockerArgs $urlValue");
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
      "CurriculumProvenance",
    ]) {
      expect(guard).toContain(requirement);
    }
  });
});
