/**
 * __tests__/migrations/auditlog-index.test.ts
 *
 * Verifies that the AuditLog composite index migration (Gap 3) exists
 * and contains the correct DDL statement.
 *
 * This test is intentionally minimal: it does not connect to a database.
 * It confirms the migration artefact is present and correct so that a CI
 * run catches accidental deletion or rename of the migration file.
 */

import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { describe, it, expect } from "vitest";

const MIGRATION_DIR = resolve(
  __dirname,
  "../../prisma/migrations/20260302_add_auditlog_composite_index"
);
const MIGRATION_FILE = join(MIGRATION_DIR, "migration.sql");

describe("AuditLog composite index migration (Gap 3)", () => {
  it("migration directory exists", () => {
    expect(existsSync(MIGRATION_DIR)).toBe(true);
  });

  it("migration.sql file exists", () => {
    expect(existsSync(MIGRATION_FILE)).toBe(true);
  });

  it("contains the correct index name", () => {
    const sql = readFileSync(MIGRATION_FILE, "utf8");
    expect(sql).toContain("AuditLog_schoolId_action_createdAt_idx");
  });

  it("creates index on the AuditLog table", () => {
    const sql = readFileSync(MIGRATION_FILE, "utf8");
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/);
    expect(sql).toContain('"AuditLog"');
  });

  it("index covers schoolId, action, createdAt columns", () => {
    const sql = readFileSync(MIGRATION_FILE, "utf8");
    expect(sql).toContain('"schoolId"');
    expect(sql).toContain('"action"');
    expect(sql).toContain('"createdAt"');
  });
});
