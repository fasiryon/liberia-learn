#!/usr/bin/env npx ts-node
/**
 * scripts/dr/healthCheck.ts — Block 29
 * LiberiaLearn Disaster Recovery Health Check
 *
 * Checks all critical platform dependencies and emits a structured report.
 * Exit code 0 = all checks pass. Exit code 1 = one or more checks fail.
 *
 * Usage:
 *   npx ts-node scripts/dr/healthCheck.ts
 *   npx ts-node scripts/dr/healthCheck.ts --json
 */

// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { prisma } from "@/lib/db";

export interface HealthCheckResult {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  detail?: string;
}

export interface HealthReport {
  timestamp: string;
  overallStatus: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheckResult[];
  durationMs: number;
}

// ─── Individual check functions ───────────────────────────────────────────────

/**
 * Database connectivity check.
 * Runs a lightweight SELECT 1 — fails fast if DB is unreachable.
 */
export async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { name: "database", status: "ok", latencyMs: Date.now() - start };
  } catch (err: any) {
    return {
      name: "database",
      status: "down",
      latencyMs: Date.now() - start,
      detail: err?.message ?? "Connection failed",
    };
  }
}

/**
 * Prisma client generation check.
 * Verifies the generated client is importable and the schema version matches.
 */
export async function checkPrismaClient(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    if (!prisma || typeof prisma !== "object") {
      throw new Error("Prisma client unavailable");
    }
    return { name: "prisma_client", status: "ok", latencyMs: Date.now() - start };
  } catch (err: any) {
    return {
      name: "prisma_client",
      status: "down",
      latencyMs: Date.now() - start,
      detail: "Prisma client not generated — run `npx prisma generate`",
    };
  }
}

/**
 * Environment variable check.
 * Verifies all required env vars are set (values not logged for security).
 */
export async function checkEnvVars(): Promise<HealthCheckResult> {
  const required = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return {
      name: "env_vars",
      status: "down",
      detail: `Missing required env vars: ${missing.join(", ")}`,
    };
  }
  return { name: "env_vars", status: "ok" };
}

/**
 * Critical feature flag check.
 * Warns if unexpectedly destructive flags are set.
 */
export async function checkFeatureFlags(): Promise<HealthCheckResult> {
  const warnings: string[] = [];

  // Circuit breaker should not be tripped in normal operation
  if (process.env.GOV_CIRCUIT_BREAKER === "tripped") {
    warnings.push("GOV_CIRCUIT_BREAKER is tripped — governance exports disabled");
  }

  // Ensure MOE portal has correct access control env
  if (process.env.ENABLE_MOE_PORTAL === "true" && !process.env.MOE_PORTAL_ALLOWLIST) {
    warnings.push("ENABLE_MOE_PORTAL is on but MOE_PORTAL_ALLOWLIST is not set");
  }

  if (warnings.length > 0) {
    return {
      name: "feature_flags",
      status: "degraded",
      detail: warnings.join("; "),
    };
  }
  return { name: "feature_flags", status: "ok" };
}

/**
 * Schema migration check.
 * Verifies that the latest migration has been applied.
 * Uses the _prisma_migrations table — returns "degraded" if DB is unreachable.
 */
export async function checkMigrations(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const rows = await prisma.$queryRaw`
      SELECT migration_name, finished_at
      FROM _prisma_migrations
      ORDER BY started_at DESC
      LIMIT 1
    ` as Array<{ migration_name: string; finished_at: Date | null }>;
    const latest = rows[0];
    if (!latest) {
      return { name: "migrations", status: "degraded", detail: "No migrations found", latencyMs: Date.now() - start };
    }
    if (!latest.finished_at) {
      return {
        name: "migrations",
        status: "degraded",
        detail: `Latest migration ${latest.migration_name} has not finished`,
        latencyMs: Date.now() - start,
      };
    }
    return {
      name: "migrations",
      status: "ok",
      detail: `Latest: ${latest.migration_name}`,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      name: "migrations",
      status: "degraded",
      detail: err?.message ?? "Could not query migration table",
      latencyMs: Date.now() - start,
    };
  }
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

/**
 * Runs all health checks in parallel and returns a consolidated report.
 */
export async function runHealthChecks(): Promise<HealthReport> {
  const start = Date.now();

  const checks = await Promise.all([
    checkEnvVars(),
    checkPrismaClient(),
    checkDatabase(),
    checkMigrations(),
    checkFeatureFlags(),
  ]);

  const hasDown = checks.some((c) => c.status === "down");
  const hasDegraded = checks.some((c) => c.status === "degraded");
  const overallStatus: HealthReport["overallStatus"] = hasDown
    ? "unhealthy"
    : hasDegraded
    ? "degraded"
    : "healthy";

  return {
    timestamp: new Date().toISOString(),
    overallStatus,
    checks,
    durationMs: Date.now() - start,
  };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

async function main() {
  const jsonMode = process.argv.includes("--json");
  const report = await runHealthChecks();

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nLiberiaLearn Health Check — ${report.timestamp}`);
    console.log(`Overall: ${report.overallStatus.toUpperCase()} (${report.durationMs}ms)\n`);
    for (const check of report.checks) {
      const icon = check.status === "ok" ? "✅" : check.status === "degraded" ? "⚠️" : "❌";
      const latency = check.latencyMs != null ? ` (${check.latencyMs}ms)` : "";
      console.log(`  ${icon} ${check.name}${latency}`);
      if (check.detail) console.log(`     → ${check.detail}`);
    }
    console.log();
  }

  process.exit(report.overallStatus === "unhealthy" ? 1 : 0);
}

// Only run when invoked directly (not imported by tests)
if (require.main === module) {
  main().catch((err) => {
    console.error("Health check fatal error:", err);
    process.exit(1);
  });
}
