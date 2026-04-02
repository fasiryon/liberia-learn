/**
 * __tests__/dr/healthCheck.test.ts — Block 29
 * Unit tests for the DR health check functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkEnvVars,
  checkFeatureFlags,
  checkPrismaClient,
  runHealthChecks,
  type HealthCheckResult,
} from "@/scripts/dr/healthCheck";

// ─── Mock @/lib/db and @prisma/client ────────────────────────────────────────

const mockQueryRaw = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {},
}));

// ─── Env var helpers ──────────────────────────────────────────────────────────

const REQUIRED_VARS = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"];

function setRequiredEnv() {
  process.env.DATABASE_URL = "postgresql://test";
  process.env.NEXTAUTH_SECRET = "secret";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}

function clearRequiredEnv() {
  for (const key of REQUIRED_VARS) {
    delete process.env[key];
  }
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setRequiredEnv();
  delete process.env.GOV_CIRCUIT_BREAKER;
  delete process.env.ENABLE_MOE_PORTAL;
  delete process.env.MOE_PORTAL_ALLOWLIST;

  // $queryRaw is used as a tagged template literal (first arg is TemplateStringsArray).
  // Both checkDatabase (SELECT 1) and checkMigrations (migration table) use this mock.
  mockQueryRaw.mockImplementation(async (...args: any[]) => {
    const firstArg = args[0];
    const sql = Array.isArray(firstArg) ? String(firstArg[0] ?? "") : String(firstArg ?? "");
    if (sql.includes("SELECT 1")) return [{ "?column?": 1 }];
    if (sql.includes("_prisma_migrations")) {
      return [{ migration_name: "20260301_000001_moe_official_role", finished_at: new Date() }];
    }
    return [];
  });
});

afterEach(() => {
  clearRequiredEnv();
});

// ─── checkEnvVars ─────────────────────────────────────────────────────────────

describe("checkEnvVars", () => {
  it("returns ok when all required vars are set", async () => {
    const result = await checkEnvVars();
    expect(result.status).toBe("ok");
    expect(result.name).toBe("env_vars");
  });

  it("returns down when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    const result = await checkEnvVars();
    expect(result.status).toBe("down");
    expect(result.detail).toContain("DATABASE_URL");
  });

  it("returns down when NEXTAUTH_SECRET is missing", async () => {
    delete process.env.NEXTAUTH_SECRET;
    const result = await checkEnvVars();
    expect(result.status).toBe("down");
    expect(result.detail).toContain("NEXTAUTH_SECRET");
  });

  it("lists all missing vars in detail", async () => {
    clearRequiredEnv();
    const result = await checkEnvVars();
    expect(result.status).toBe("down");
    for (const v of REQUIRED_VARS) {
      expect(result.detail).toContain(v);
    }
  });
});

// ─── checkFeatureFlags ────────────────────────────────────────────────────────

describe("checkFeatureFlags", () => {
  it("returns ok with no warning flags set", async () => {
    const result = await checkFeatureFlags();
    expect(result.status).toBe("ok");
  });

  it("returns degraded when GOV_CIRCUIT_BREAKER is tripped", async () => {
    process.env.GOV_CIRCUIT_BREAKER = "tripped";
    const result = await checkFeatureFlags();
    expect(result.status).toBe("degraded");
    expect(result.detail).toContain("GOV_CIRCUIT_BREAKER");
  });

  it("returns degraded when ENABLE_MOE_PORTAL is on without allowlist", async () => {
    process.env.ENABLE_MOE_PORTAL = "true";
    const result = await checkFeatureFlags();
    expect(result.status).toBe("degraded");
    expect(result.detail).toContain("MOE_PORTAL_ALLOWLIST");
  });

  it("returns ok when ENABLE_MOE_PORTAL is on WITH allowlist set", async () => {
    process.env.ENABLE_MOE_PORTAL = "true";
    process.env.MOE_PORTAL_ALLOWLIST = "gov.lr,moe.gov.lr";
    const result = await checkFeatureFlags();
    expect(result.status).toBe("ok");
  });
});

// ─── checkPrismaClient ────────────────────────────────────────────────────────

describe("checkPrismaClient", () => {
  it("returns ok when @prisma/client imports successfully", async () => {
    const result = await checkPrismaClient();
    expect(result.status).toBe("ok");
    expect(result.name).toBe("prisma_client");
  }, 15_000);
});

// ─── runHealthChecks ──────────────────────────────────────────────────────────

describe("runHealthChecks", () => {
  it("returns healthy when all checks pass", async () => {
    const report = await runHealthChecks();
    const failing = report.checks.filter((c) => c.status !== "ok");
    if (failing.length > 0) console.error("DEGRADED CHECKS:", JSON.stringify(failing));
    expect(report.overallStatus).toBe("healthy");
    expect(report.checks).toHaveLength(5);
    expect(report.timestamp).toBeDefined();
    expect(typeof report.durationMs).toBe("number");
  });

  it("returns unhealthy when DATABASE_URL is missing (env check fails)", async () => {
    delete process.env.DATABASE_URL;
    const report = await runHealthChecks();
    expect(report.overallStatus).toBe("unhealthy");
    const envCheck = report.checks.find((c) => c.name === "env_vars");
    expect(envCheck?.status).toBe("down");
  });

  it("returns degraded when a flag warning is present", async () => {
    process.env.GOV_CIRCUIT_BREAKER = "tripped";
    const report = await runHealthChecks();
    expect(["degraded", "unhealthy"]).toContain(report.overallStatus);
    const flagCheck = report.checks.find((c) => c.name === "feature_flags");
    expect(flagCheck?.status).toBe("degraded");
  });

  it("includes all five check names in report", async () => {
    const report = await runHealthChecks();
    const names = report.checks.map((c) => c.name);
    expect(names).toContain("env_vars");
    expect(names).toContain("prisma_client");
    expect(names).toContain("database");
    expect(names).toContain("migrations");
    expect(names).toContain("feature_flags");
  });

  it("reports unhealthy when DB is down", async () => {
    mockQueryRaw.mockRejectedValue(new Error("ECONNREFUSED"));
    const report = await runHealthChecks();
    const dbCheck = report.checks.find((c) => c.name === "database");
    expect(dbCheck?.status).toBe("down");
    expect(report.overallStatus).toBe("unhealthy");
  });
});

// ─── rollbackPlan utilities ───────────────────────────────────────────────────

import {
  getRollbackPlan,
  listRollbackBlocks,
  validateRollback,
} from "@/scripts/dr/rollbackPlan";

describe("rollbackPlan utilities", () => {
  it("getRollbackPlan returns plan for block 28", () => {
    const plan = getRollbackPlan(28);
    expect(plan).toBeDefined();
    expect(plan?.block).toBe(28);
    expect(plan?.steps.length).toBeGreaterThan(0);
  });

  it("getRollbackPlan returns undefined for unknown block", () => {
    expect(getRollbackPlan(999)).toBeUndefined();
  });

  it("listRollbackBlocks returns array with block numbers and titles", () => {
    const list = listRollbackBlocks();
    expect(list.length).toBeGreaterThan(0);
    for (const entry of list) {
      expect(typeof entry.block).toBe("number");
      expect(typeof entry.title).toBe("string");
      expect(entry.dataRisk).toBeDefined();
    }
  });

  it("validateRollback block 28: safe=true, dataRisk=low", () => {
    const { safe, dataRisk, irreversibleSteps } = validateRollback(28);
    expect(safe).toBe(true);
    expect(dataRisk).toBe("low");
    // Schema enum drop step is irreversible
    expect(irreversibleSteps.length).toBeGreaterThan(0);
  });

  it("validateRollback block 27: safe=true, dataRisk=none", () => {
    const { safe, dataRisk, irreversibleSteps } = validateRollback(27);
    expect(safe).toBe(true);
    expect(dataRisk).toBe("none");
    expect(irreversibleSteps).toHaveLength(0);
  });

  it("validateRollback unknown block returns safe=false", () => {
    const { safe } = validateRollback(999);
    expect(safe).toBe(false);
  });

  it("all rollback plan steps have required fields", () => {
    for (const plan of [28, 27, 26].map(getRollbackPlan)) {
      if (!plan) continue;
      for (const step of plan.steps) {
        expect(typeof step.order).toBe("number");
        expect(typeof step.action).toBe("string");
        expect(["schema", "flag", "code", "cache", "verify"]).toContain(step.category);
        expect(typeof step.reversible).toBe("boolean");
      }
    }
  });
});
